"""The mail seam: what gets sent, what gets logged, and what happens when the relay is down.

Two flows in this system cannot be completed by the person who starts them — accepting an
invitation and resetting a password — so both depend on a message reaching someone. These tests
cover the transport choice, the message itself, and the two failure modes that matter: a relay that
is unreachable, and a relay that works (which changes what may be written to the log).
"""

from __future__ import annotations

import logging
from dataclasses import replace
from email import message_from_string
from typing import Any

import pytest
from proofstep_api.security import resets
from proofstep_api.services import email as email_service
from proofstep_api.services import email_templates
from proofstep_api.settings import Settings

SECRET = "a-secret-long-enough-for-production-use"


def settings(**overrides: Any) -> Settings:
    return Settings(env="test", jwt_secret=SECRET, **overrides)


@pytest.fixture(autouse=True)
def _reset_sender() -> Any:
    """The transport is memoized per process, so it has to be cleared between tests."""
    email_service.set_sender(None)
    yield
    email_service.set_sender(None)


class Recorder:
    """A transport that keeps what it was given. `configured` is parameterised deliberately.

    Whether a sender is "configured" is not cosmetic — it decides whether a password reset link is
    written to the application log — so tests need to exercise both answers.
    """

    def __init__(self, *, configured: bool = True, fails: bool = False) -> None:
        self.configured = configured
        self.sent: list[email_service.EmailMessage] = []
        self._fails = fails

    async def send(self, message: email_service.EmailMessage) -> None:
        if self._fails:
            msg = "the relay refused the connection"
            raise ConnectionRefusedError(msg)
        self.sent.append(message)


class TestChoosingATransport:
    def test_no_host_configured_means_the_logging_sender(self) -> None:
        """The default, and a supported configuration rather than a broken one.

        A self-hosted install with no relay still has to be able to invite a colleague. Making SMTP
        a hard requirement would mean the product does not work until somebody configures one.
        """
        sender = email_service.get_sender(settings())
        assert isinstance(sender, email_service.LoggingEmailSender)
        assert sender.configured is False

    def test_a_host_means_smtp(self) -> None:
        sender = email_service.get_sender(settings(smtp_host="smtp.example.com"))
        assert isinstance(sender, email_service.SmtpEmailSender)
        assert sender.configured is True

    def test_the_transport_is_memoized(self) -> None:
        # One client per process, not one per message.
        config = settings(smtp_host="smtp.example.com")
        assert email_service.get_sender(config) is email_service.get_sender(config)


class TestFailureIsNotTheCallersProblem:
    async def test_a_dead_relay_does_not_raise(self) -> None:
        """The action being notified about already happened.

        `send` is scheduled after the response is written, so by the time a relay refuses there is
        nobody left to hand an exception to — and an unhandled one in a background task is a dead
        task plus a log line nobody reads.
        """
        email_service.set_sender(Recorder(fails=True))
        message = email_service.EmailMessage(to="a@example.com", subject="s", text="t", html="h")
        await email_service.send(message, settings=settings())  # must not raise

    async def test_the_failure_is_logged_with_enough_to_act_on(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        email_service.set_sender(Recorder(fails=True))
        message = email_service.EmailMessage(
            to="someone@example.com", subject="Reset your password", text="t", html="h"
        )
        with caplog.at_level(logging.ERROR, logger="proofstep_api.services.email"):
            await email_service.send(message, settings=settings())
        logged = caplog.text
        assert "someone@example.com" in logged
        assert "Reset your password" in logged


class TestWhatReachesTheLog:
    """The property that changes the moment a relay is configured.

    With no transport, the reset link *must* be logged — the log is then the only route it has to a
    human, and `scripts/reset_link.py` exists for the same reason. With a transport, logging the
    same link would mean every account in the system is one log query away from takeover, for no
    benefit at all: it already reached the person it was for.
    """

    async def test_without_a_transport_the_link_is_logged(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        email_service.set_sender(email_service.LoggingEmailSender())
        with caplog.at_level(logging.WARNING):
            await resets.deliver("someone@example.com", "the-secret-token", settings=settings())
        assert "the-secret-token" in caplog.text

    async def test_with_a_transport_the_link_is_not_logged(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        recorder = Recorder(configured=True)
        email_service.set_sender(recorder)
        with caplog.at_level(logging.DEBUG):
            await resets.deliver("someone@example.com", "the-secret-token", settings=settings())

        assert "the-secret-token" not in caplog.text, "a live reset link was written to the log"
        # The address still is, so "did we try to mail this person?" stays answerable in a support
        # conversation without the log carrying the credential.
        assert "someone@example.com" in caplog.text
        assert recorder.sent, "and it was actually sent"
        assert "the-secret-token" in recorder.sent[0].text

    async def test_an_invitation_link_is_not_logged_either(
        self, caplog: pytest.LogCaptureFixture
    ) -> None:
        """An invitation needs no log fallback: the token is already in the API response.

        So there is no configuration in which writing it to the log helps anybody, which is the
        difference between this and a password reset.
        """
        from proofstep_api.api.routes.accounts import _deliver_invitation

        email_service.set_sender(email_service.LoggingEmailSender())
        with caplog.at_level(logging.DEBUG):
            await _deliver_invitation(
                to="invitee@example.com",
                token="the-invite-token",
                role="developer",
                organization="Acme",
                invited_by="owner@example.com",
                settings=settings(),
            )
        assert "the-invite-token" not in caplog.text


class TestTheMessages:
    def test_a_reset_carries_the_link_in_both_parts(self) -> None:
        # A text part whose meaning depends on the HTML one is not a fallback.
        message = email_templates.password_reset(
            reset_url="https://app.example.com/reset?token=abc", expires_minutes=60
        )
        assert "https://app.example.com/reset?token=abc" in message.text
        assert "https://app.example.com/reset?token=abc" in message.html

    def test_an_invitation_names_the_workspace_and_the_inviter(self) -> None:
        """Both, because an invitation that names neither is indistinguishable from phishing."""
        message = email_templates.invitation(
            organization="Acme",
            role="developer",
            invite_url="https://app.example.com/invite?token=xyz",
            invited_by="dana@example.com",
            expires_days=14,
        )
        assert "Acme" in message.subject
        assert "dana@example.com" in message.text
        assert "Acme" in message.text

    def test_an_invitation_without_a_known_inviter_still_reads_sensibly(self) -> None:
        message = email_templates.invitation(
            organization="Acme",
            role="viewer",
            invite_url="https://app.example.com/invite?token=xyz",
            invited_by=None,
            expires_days=14,
        )
        assert "None" not in message.subject
        assert "None" not in message.text

    def test_a_workspace_name_cannot_inject_html(self) -> None:
        """A stored cross-site scripting payload, mailed to a colleague, signed by our domain.

        Organization names are chosen by users, and this one goes straight into an HTML body.
        """
        message = email_templates.invitation(
            organization='<img src=x onerror="alert(1)">',
            role="developer",
            invite_url="https://app.example.com/invite?token=xyz",
            invited_by='<script>alert("inviter")</script>',
            expires_days=14,
        )
        assert "<img" not in message.html
        assert "<script>" not in message.html
        assert "&lt;img" in message.html


class TestTheWireFormat:
    """What actually goes down the socket, assembled by the SMTP sender."""

    @staticmethod
    def _mime(message: email_service.EmailMessage) -> Any:
        sender = email_service.SmtpEmailSender(
            host="smtp.example.com",
            port=587,
            username=None,
            password=None,
            sender="Proofstep <no-reply@example.com>",
            use_tls=False,
            use_starttls=True,
            timeout_s=5.0,
        )
        return message_from_string(str(sender._build(message)))

    def test_it_is_multipart_alternative_with_text_first(self) -> None:
        # Least-preferred part first is what the standard requires, so a client that renders
        # neither still shows something readable.
        mime = self._mime(
            email_service.EmailMessage(to="a@example.com", subject="s", text="plain", html="<p>x")
        )
        assert mime.get_content_type() == "multipart/alternative"
        parts = [p.get_content_type() for p in mime.walk() if p.get_content_maintype() == "text"]
        assert parts == ["text/plain", "text/html"]

    def test_the_headers_are_what_a_relay_needs(self) -> None:
        mime = self._mime(
            email_service.EmailMessage(
                to="recipient@example.com", subject="Reset your password", text="t", html="h"
            )
        )
        assert mime["To"] == "recipient@example.com"
        assert mime["From"] == "Proofstep <no-reply@example.com>"
        assert mime["Subject"] == "Reset your password"

    def test_the_recipient_is_set_by_the_caller_not_the_template(self) -> None:
        # Templates build a message with no recipient; the caller fills it in. That keeps "who is
        # this for" at the call site, where the authorisation decision was made.
        message = email_templates.password_reset(reset_url="https://x/y", expires_minutes=60)
        assert message.to == ""
        assert replace(message, to="a@example.com").to == "a@example.com"


class TestAgainstARealSocket:
    """One test that speaks SMTP for real, because the others do not.

    Everything above builds a message or records a call. None of it would notice if the client
    never connected, greeted the server wrongly, or sent the body before `DATA` — the protocol
    conversation is exactly the part a mock cannot check, and it is the part that fails against a
    relay nobody tested with.

    A throwaway server on an ephemeral port rather than a dependency on `aiosmtpd`: it needs to
    answer four verbs, and a socket does that in fewer lines than the import would take.
    """

    @staticmethod
    def _serve(sock: Any, received: list[str]) -> None:
        connection, _ = sock.accept()
        stream = connection.makefile("rwb", buffering=0)

        def say(line: str) -> None:
            stream.write((line + "\r\n").encode())

        say("220 localhost ESMTP")
        body: list[str] = []
        in_data = False
        while True:
            raw = stream.readline()
            if not raw:
                break
            text = raw.decode(errors="replace").rstrip("\r\n")
            if in_data:
                if text == ".":
                    received.append("\n".join(body))
                    say("250 OK queued")
                    in_data = False
                    continue
                body.append(text)
                continue
            verb = text.upper()
            if verb.startswith(("EHLO", "HELO")):
                say("250-localhost")
                say("250 HELP")
            elif verb.startswith(("MAIL", "RCPT")):
                say("250 OK")
            elif verb.startswith("DATA"):
                say("354 End with .")
                in_data = True
            elif verb.startswith("QUIT"):
                say("221 Bye")
                break
            else:
                say("250 OK")
        connection.close()

    async def test_a_reset_email_survives_the_round_trip(self) -> None:
        import socket
        import threading

        received: list[str] = []
        listener = socket.socket()
        listener.bind(("127.0.0.1", 0))
        listener.listen(1)
        port = listener.getsockname()[1]
        thread = threading.Thread(target=self._serve, args=(listener, received), daemon=True)
        thread.start()

        try:
            sender = email_service.SmtpEmailSender(
                host="127.0.0.1",
                port=port,
                username=None,
                password=None,
                sender="Proofstep <no-reply@example.com>",
                use_tls=False,
                use_starttls=False,
                timeout_s=5.0,
            )
            message = email_templates.password_reset(
                reset_url="https://app.example.com/reset?token=REALTOKEN", expires_minutes=60
            )
            await sender.send(replace(message, to="someone@example.com"))
            thread.join(timeout=5)
        finally:
            listener.close()

        assert received, "nothing arrived at the server"
        raw = received[0]
        assert "To: someone@example.com" in raw
        assert "From: Proofstep <no-reply@example.com>" in raw
        assert "Subject: Reset your Proofstep password" in raw
        assert "multipart/alternative" in raw
        # Both parts, and the link intact through MIME encoding — a body that arrives with the
        # token line-wrapped or quoted-printable-mangled is a link that does not work.
        assert "text/plain" in raw
        assert "text/html" in raw
        assert "REALTOKEN" in raw
