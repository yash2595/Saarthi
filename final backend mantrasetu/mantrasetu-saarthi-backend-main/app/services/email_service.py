"""Bounded email delivery; missing configuration is never reported as delivery."""
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html import escape
import logging
import smtplib
import ssl

import httpx
from fastapi.concurrency import run_in_threadpool
from app.core.config import settings

logger = logging.getLogger('mantrasetu.email')


async def _deliver(subject: str, to_email: str, text: str, html: str) -> bool:
    if settings.RESEND_API_KEY and settings.EMAIL_FROM:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.post('https://api.resend.com/emails',
                    headers={'Authorization': f'Bearer {settings.RESEND_API_KEY}'},
                    json={'from': settings.EMAIL_FROM, 'to': [to_email], 'subject': subject, 'text': text, 'html': html})
            if response.is_success:
                return True
            logger.warning('Email API rejected delivery (HTTP %s)', response.status_code)
        except httpx.HTTPError:
            logger.warning('Email API delivery failed')
        return False
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        logger.info('Email delivery is not configured')
        return False

    def send_smtp() -> bool:
        message = MIMEMultipart('alternative')
        message['Subject'] = subject
        message['From'] = settings.EMAIL_FROM or settings.SMTP_USERNAME
        message['To'] = to_email
        message.attach(MIMEText(text, 'plain', 'utf-8'))
        message.attach(MIMEText(html, 'html', 'utf-8'))
        try:
            with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT, timeout=10) as server:
                server.starttls(context=ssl.create_default_context())
                server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                server.send_message(message)
            return True
        except (smtplib.SMTPException, OSError):
            logger.warning('SMTP delivery failed')
            return False
    return await run_in_threadpool(send_smtp)


async def send_verification_email(to_email: str, verify_url: str) -> bool:
    text = f'Namaste!\n\nVerify your MantraSetu account:\n{verify_url}\n\nThis link expires in 24 hours.'
    html = f'<h2>Namaste!</h2><p><a href="{escape(verify_url, quote=True)}">Verify your MantraSetu account</a></p><p>This link expires in 24 hours.</p>'
    return await _deliver('Verify your MantraSetu account', to_email, text, html)


async def send_draft_resume_email(to_email: str, draft_url: str, pandit_name: str = '') -> bool:
    greeting = f'Namaste {pandit_name}!' if pandit_name else 'Namaste!'
    text = f'{greeting}\n\nYour registration draft is saved. Resume using this private link:\n{draft_url}\n\nThe link expires in seven days.'
    html = f'<h2>{escape(greeting)}</h2><p><a href="{escape(draft_url, quote=True)}">Resume your registration</a></p><p>This private link expires in seven days.</p>'
    return await _deliver('Your MantraSetu registration draft', to_email, text, html)


async def send_status_update_email(to_email: str, pandit_name: str, new_status: str, rejection_reason: str | None = None) -> bool:
    if new_status not in {'approved', 'rejected'}:
        return False
    text = f'Namaste {pandit_name}!\n\nYour MantraSetu application is {new_status}.'
    if rejection_reason:
        text += f'\nReason: {rejection_reason}'
    return await _deliver('MantraSetu application status', to_email, text, f'<p>{escape(text).replace(chr(10), "<br>")}</p>')
