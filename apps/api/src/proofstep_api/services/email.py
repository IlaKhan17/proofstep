"""Sending mail, and the seam that lets a deployment not send any.

Two implementations of one protocol. `SmtpEmailSender` talks to whatever relay is configured;
`LoggingEmailSender` writes the message to the application log and is what runs when nothing is
configured, which is the default and the common case for a self-hosted install.

**Why SMTP rather than a provider's SDK.** Every hosted mail provider speaks SMTP — Resend,
Postmark, SES, Mailgun, and a company's own Exchange relay — so one implementation reaches all of
them with a host and a password, and none of them can be the reason this codebase gains a
dependency. A provider SDK would buy webhooks and delivery analytics that this system does not use,
in exchange for making the choice of vendor a code change.

**Why the logging sender is a first-class implementation and not a stub.** A self-hosted Proofstep
with no mail server still has to be able to invite a colleague and reset a password. Making SMTP a
hard requirement would mean the product does not work until someone configures a relay, which for a
team trying it out on an afternoon is the difference between "it works" and "it does not". So the
absence of transport is a supported configuration, not a broken one — and it says so, loudly, in
the log line it writes.

**Sending never fails the request that triggered it.** A relay being down is not a reason to refuse
a signup or tell someone their password reset did not happen — the row is already written and the
link is already valid, so the truthful outcome is "your reset exists, the mail is late". Failures
are logged and swallowed, which is the same reasoning as `worker/deadletter.py`: a notification
that can take down the thing it notifies about is worse than no notification.

**And it happens off the request path.** `/auth/forgot` answers identically whether or not an
address has an account, which is what stops it being a membership oracle. An SMTP round trip on
only one of those two branches would put several hundred milliseconds of difference between them
and hand back the same oracle through a stopwatch. Callers schedule sends with FastAPI's
`BackgroundTasks`, so the response is already written before the socket is opened.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
import ssl
from dataclasses import dataclass
from email.message import EmailMessage as MimeMessage
from typing import TYPE_CHECKING, Protocol

if TYPE_CHECKING:
    from proofstep_api.settings import Settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class EmailMessage:
    """One message, in both representations.

    Text and HTML together as `multipart/alternative`, rather than either alone. HTML-only is
    unreadable in a terminal client and is what spam filters expect least; text-only from a product
    reads as broken. The text part is written to stand on its own — every link appears in full,
    because a text part whose meaning depends on the HTML one is not a fallback.
    """

    to: str
    subject: str
    text: str
    html: str


class EmailSender(Protocol):
    """What a transport has to do.

    A Protocol rather than a base class: the two implementations share no behaviour worth
    inheriting, and structural typing means a test can pass a recorder without importing anything
    from here.
    """

    async def send(self, message: EmailMessage) -> None: ...

    @property
    def configured(self) -> bool:
        """Whether this sender actually delivers mail to a person.

        Callers use it to decide what may be logged. When nothing is configured, a password reset
        link has to reach the operator somehow and the log is the only route it has; once a real
        transport exists, writing that same link to the log would be handing every account to
        whoever can read it.
        """
        ...


class LoggingEmailSender:
    """Writes the message where an operator can find it. The default.

    Not a no-op and not a test double: this is how a self-hosted install with no relay actually
    delivers an invitation or a reset link, and `scripts/reset_link.py` exists so that path does
    not require the person to go through a form first.
    """

    configured = False

    async def send(self, message: EmailMessage) -> None:
        logger.warning(
            "EMAIL NOT SENT — no mail transport is configured, so this log is the delivery "
            "mechanism (see services/email.py and docs/OPERATIONS.md §7).\n"
            "  to:      %s\n"
            "  subject: %s\n"
            "%s",
            message.to,
            message.subject,
            "\n".join(f"  | {line}" for line in message.text.splitlines()),
        )


class SmtpEmailSender:
    """Delivers through an SMTP relay.

    `smtplib` in a worker thread rather than an async SMTP library. The blocking client is in the
    standard library, is what every relay is tested against, and one thread for the length of a
    send costs nothing here — messages are sent one at a time in a background task, not in a hot
    loop. An async client would be a dependency bought for a concurrency problem this does not
    have.
    """

    configured = True

    def __init__(
        self,
        *,
        host: str,
        port: int,
        username: str | None,
        password: str | None,
        sender: str,
        use_tls: bool,
        use_starttls: bool,
        timeout_s: float,
    ) -> None:
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._sender = sender
        self._use_tls = use_tls
        self._use_starttls = use_starttls
        self._timeout_s = timeout_s

    async def send(self, message: EmailMessage) -> None:
        # Off the event loop: `smtplib` blocks on the socket, and blocking here would stall every
        # other request the process is serving, which is the opposite of what a background send is
        # for.
        await asyncio.to_thread(self._send_blocking, message)

    def _build(self, message: EmailMessage) -> MimeMessage:
        mime = MimeMessage()
        mime["From"] = self._sender
        mime["To"] = message.to
        mime["Subject"] = message.subject
        # `set_content` then `add_alternative` produces multipart/alternative with text first,
        # which is the order the standard requires: least-preferred part first, so a client that
        # renders neither still shows something readable.
        mime.set_content(message.text)
        mime.add_alternative(message.html, subtype="html")
        return mime

    def _send_blocking(self, message: EmailMessage) -> None:
        mime = self._build(message)
        # `create_default_context` verifies the certificate and the hostname. A relay whose
        # certificate does not check out is one that might not be the relay, and mail sent through
        # it carries invitation and password-reset links.
        context = ssl.create_default_context()

        if self._use_tls:
            client: smtplib.SMTP = smtplib.SMTP_SSL(
                self._host, self._port, timeout=self._timeout_s, context=context
            )
        else:
            client = smtplib.SMTP(self._host, self._port, timeout=self._timeout_s)

        try:
            if self._use_starttls:
                client.starttls(context=context)
            if self._username and self._password:
                # Some relays take mail from an allow-listed source with no credential at all, so
                # authentication is conditional rather than assumed — requiring it would rule out
                # a local postfix, which is a perfectly ordinary way to run this.
                client.login(self._username, self._password)
            client.send_message(mime)
        finally:
            # `quit` can itself raise if the connection is already gone, and a failure to say
            # goodbye politely must not mask a message that was actually delivered.
            try:
                client.quit()
            except Exception:
                client.close()


_sender: EmailSender | None = None


def get_sender(settings: Settings) -> EmailSender:
    """The configured transport, memoized per process.

    Falls back to the logging sender when no host is set, which is the default. That fallback is
    reported at startup rather than discovered when the first invitation quietly goes nowhere —
    see `main.py`.
    """
    global _sender  # noqa: PLW0603 — one transport per process
    if _sender is not None:
        return _sender

    if not settings.smtp_host:
        _sender = LoggingEmailSender()
        return _sender

    _sender = SmtpEmailSender(
        host=settings.smtp_host,
        port=settings.smtp_port,
        username=settings.smtp_username or None,
        password=settings.smtp_password or None,
        sender=settings.email_from,
        use_tls=settings.smtp_tls,
        use_starttls=settings.smtp_starttls,
        timeout_s=settings.smtp_timeout_s,
    )
    return _sender


def set_sender(sender: EmailSender | None) -> None:
    """Override the process transport. For tests and for explicit wiring."""
    global _sender  # noqa: PLW0603
    _sender = sender


async def send(message: EmailMessage, *, settings: Settings) -> None:
    """Send one message, or explain why it could not be sent. Never raises.

    The swallowing is the point — see the note at the top of the module. A caller schedules this
    and returns; there is nobody left to hand an exception to, and an unhandled one in a background
    task is a log line nobody reads plus a task that dies silently.
    """
    sender = get_sender(settings)
    try:
        await sender.send(message)
    except Exception:
        logger.exception(
            "could not send %r to %s; the action it notifies about still happened",
            message.subject,
            message.to,
        )
