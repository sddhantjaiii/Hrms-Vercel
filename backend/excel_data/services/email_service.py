import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


def generate_otp(length=6):
    """Generate a random OTP code"""
    return ''.join(random.choices(string.digits, k=length))


def send_invitation_email(invitation_token):
    """Send invitation email with link to set password"""
    try:
        tenant = invitation_token.tenant
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        invitation_link = f"{frontend_url}/accept-invitation?token={invitation_token.token}"
        
        subject = f"Invitation to join {tenant.name} - HRMS"
        
        message = f"""
Welcome to {tenant.name} - HR Management System

Hello {invitation_token.first_name} {invitation_token.last_name},

You have been invited to join {tenant.name} as a {invitation_token.get_role_display()} in our HR Management System.

To complete your registration and set up your password, please visit:
{invitation_link}

This invitation link will expire in {getattr(settings, 'INVITATION_EXPIRE_HOURS', 48)} hours.

This invitation was sent by {invitation_token.invited_by.email} from {tenant.name}.

If you have any questions, please contact your administrator.

Best regards,
The HRMS Team
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[invitation_token.email],
            fail_silently=False,
        )
        
        logger.info(f"Invitation email sent successfully to {invitation_token.email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send invitation email to {invitation_token.email}: {str(e)}")
        return False


def send_password_reset_otp(email, otp_code):
    """Send OTP code for password reset"""
    try:
        subject = "Password Reset OTP - HRMS"
        
        message = f"""
Password Reset OTP - HR Management System

Hello,

You requested to reset your password for the HR Management System.

Your OTP Code: {otp_code}

This OTP code will expire in {getattr(settings, 'PASSWORD_RESET_EXPIRE_MINUTES', 30)} minutes.

If you did not request this password reset, please ignore this email.

Best regards,
The HRMS Team
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        
        logger.info(f"Password reset OTP sent successfully to {email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send password reset OTP to {email}: {str(e)}")
        return False


def send_welcome_email(user):
    """Send welcome email after successful registration"""
    try:
        subject = f"Welcome to {user.tenant.name} - HRMS"
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')
        
        message = f"""
Welcome to {user.tenant.name} - HR Management System

Hello {user.first_name} {user.last_name},

Your account has been successfully created!

You can login at: {frontend_url}/login

Thank you for joining {user.tenant.name}!

Best regards,
The HRMS Team
        """
        
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
        
        logger.info(f"Welcome email sent successfully to {user.email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send welcome email to {user.email}: {str(e)}")
        return False


def cleanup_expired_tokens():
    """Clean up expired invitation tokens and OTP codes"""
    from .models import InvitationToken, PasswordResetOTP
    
    now = timezone.now()
    
    # Delete expired invitation tokens
    expired_invitations = InvitationToken.objects.filter(expires_at__lt=now)
    invitation_count = expired_invitations.count()
    expired_invitations.delete()
    
    # Delete expired OTP codes
    expired_otps = PasswordResetOTP.objects.filter(expires_at__lt=now)
    otp_count = expired_otps.count()
    expired_otps.delete()
    
    logger.info(f"Cleanup completed: {invitation_count} expired invitations and {otp_count} expired OTPs deleted")
    
    return invitation_count, otp_count 