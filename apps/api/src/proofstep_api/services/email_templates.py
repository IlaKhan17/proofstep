"""The messages Proofstep sends, as data.

Two of them, because two flows cannot be completed by the person who starts them: an invitation has
to reach somebody who does not have an account, and a password reset has to reach somebody who
cannot sign in. Everything else the product does, it can tell you about on screen.

No template engine. Two messages do not justify a dependency, a template directory, and a loader —
and the plain functions here are type-checked and greppable in a way `templates/invite.html.j2` is
not. If this grows past a handful, that trade flips.

**Everything interpolated into the HTML is escaped**, and that is not paranoia about our own
strings: an organization name is chosen by a user, and an invitation carrying
`<img src=x onerror=...>` in a workspace name would be a stored cross-site scripting payload posted
to a colleague's mail client, from us, signed with our domain's reputation.
"""

from __future__ import annotations

from html import escape

from proofstep_api.services.email import EmailMessage

#: Kept narrow deliberately. A wall of styling is what makes a transactional message look like
#: marketing, and every additional rule is another thing a mail client renders its own way.
_STYLE = (
    "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;"
    "font-size:15px;line-height:1.6;color:#0f172a;max-width:32rem"
)
_BUTTON = (
    "display:inline-block;padding:10px 18px;background:#0f172a;color:#ffffff;"
    "text-decoration:none;border-radius:6px;font-weight:500"
)
_MUTED = "color:#64748b;font-size:13px"


def _wrap(body: str) -> str:
    return f'<div style="{_STYLE}">{body}</div>'


def _fallback(url: str) -> str:
    """The link in full, as text, under the button.

    Buttons do not survive every client, and a message whose only route to the destination is an
    anchor tag is a message that is blank for the person whose client stripped it.
    """
    return (
        f'<p style="{_MUTED}">If the button does not work, paste this into your browser:<br>'
        f'<span style="word-break:break-all">{escape(url)}</span></p>'
    )


def invitation(
    *,
    organization: str,
    role: str,
    invite_url: str,
    invited_by: str | None,
    expires_days: int,
) -> EmailMessage:
    """Somebody has been added to a workspace and needs the link to accept.

    Names the inviter when it is known. An invitation from a person is a thing you can verify by
    asking them; an invitation from nobody is indistinguishable from phishing, which is exactly
    what an unexpected "click here to join" email looks like.
    """
    who = f"{invited_by} has invited you" if invited_by else "You have been invited"
    subject = (
        f"{invited_by} invited you to {organization} on Proofstep"
        if invited_by
        else f"You have been invited to {organization} on Proofstep"
    )

    text = f"""{who} to join {organization} on Proofstep as a {role}.

Accept the invitation:
{invite_url}

This link works only for this email address and expires in {expires_days} days.

If you were not expecting this, you can ignore it — nothing happens until you accept.
"""

    html = _wrap(
        f"<p>{escape(who)} to join <strong>{escape(organization)}</strong> on Proofstep "
        f"as a {escape(role)}.</p>"
        f'<p><a href="{escape(invite_url)}" style="{_BUTTON}">Join {escape(organization)}</a></p>'
        f'<p style="{_MUTED}">This link works only for this email address and expires in '
        f"{expires_days} days.</p>"
        f"{_fallback(invite_url)}"
        f'<p style="{_MUTED}">If you were not expecting this, you can ignore it — nothing '
        f"happens until you accept.</p>"
    )
    return EmailMessage(to="", subject=subject, text=text, html=html)


def password_reset(*, reset_url: str, expires_minutes: int) -> EmailMessage:
    """Somebody asked to reset a password and needs the link.

    Deliberately says what to do if it was *not* you, and deliberately does not say "click here to
    secure your account" — an unexpected reset email is a signal worth reading calmly, and a
    message that manufactures urgency trains people to act fast on exactly the emails where they
    should slow down.
    """
    subject = "Reset your Proofstep password"

    text = f"""Someone asked to reset the password for this Proofstep account.

Choose a new password:
{reset_url}

This link can be used once and expires in {expires_minutes} minutes.

If it was not you, no action is needed — your password has not changed, and this
link cannot be used without access to this mailbox.
"""

    html = _wrap(
        "<p>Someone asked to reset the password for this Proofstep account.</p>"
        f'<p><a href="{escape(reset_url)}" style="{_BUTTON}">Choose a new password</a></p>'
        f'<p style="{_MUTED}">This link can be used once and expires in '
        f"{expires_minutes} minutes.</p>"
        f"{_fallback(reset_url)}"
        f'<p style="{_MUTED}">If it was not you, no action is needed — your password has not '
        f"changed, and this link cannot be used without access to this mailbox.</p>"
    )
    return EmailMessage(to="", subject=subject, text=text, html=html)
