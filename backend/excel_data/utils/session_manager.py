"""
Session management utilities for single-login-per-user functionality
"""
from django.utils import timezone
from django.utils.timezone import timedelta
from django.contrib.sessions.models import Session
import logging

logger = logging.getLogger(__name__)


def get_client_ip(request):
    """Get client IP address from request"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


class SessionManager:
    """Manager class for handling single-login-per-user sessions"""
    
    @staticmethod
    def check_ip_based_session(request):
        """
        Check if there's already an active session from the same IP address
        Returns (has_active_session, existing_user, message)
        """
        try:
            from ..models import ActiveSession
            
            ip_address = get_client_ip(request)
            
            # Check for any active session from this IP
            active_session = ActiveSession.objects.filter(
                ip_address=ip_address
            ).exclude(
                last_activity__lt=timezone.now() - timedelta(minutes=30)
            ).first()
            
            if active_session:
                return True, active_session.user, f"Another user ({active_session.user.email}) is already logged in from this IP address. Please logout first or use a different device."
            
            return False, None, None
            
        except Exception as e:
            logger.error(f"Error checking IP-based session: {e}")
            return False, None, None
    
    @staticmethod
    def check_existing_session(user):
        """
        Check if user has an existing active session
        Returns tuple: (has_active_session, should_deny_login, message)
        """
        if not user.current_session_key or not user.session_created_at:
            return False, False, None
        
        # Check if session is expired (5 minutes after creation for force-close scenarios)
        session_expired = timezone.now() > user.session_created_at + timedelta(minutes=5)
        
        if session_expired:
            # Session expired, clear it and allow login
            user.clear_session()
            logger.info(f"Expired session cleared for user {user.email}")
            return False, False, None
        
        # Check if the session still exists in Django's session store
        try:
            session_exists = Session.objects.filter(session_key=user.current_session_key).exists()
            if not session_exists:
                # Session doesn't exist in store, clear it and allow login
                user.clear_session()
                logger.info(f"Non-existent session cleared for user {user.email}")
                return False, False, None
        except Exception as e:
            logger.error(f"Error checking session existence for user {user.email}: {e}")
            # On error, clear session and allow login
            user.clear_session()
            return False, False, None
        
        # Session is active and exists
        return True, True, "User already logged in on another device. Please logout from the other device first."
    
    @staticmethod
    def create_new_session(user, request):
        """
        Create a new session for the user and track by IP address
        Ensures session is created and stored properly
        """
        # Ensure session is created
        if not request.session.session_key:
            request.session.create()
        
        session_key = request.session.session_key
        ip_address = get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        
        # Store session info in the session data
        request.session['user_id'] = user.id
        request.session['user_email'] = user.email
        request.session['session_created_at'] = timezone.now().isoformat()
        request.session.save()
        
        # Track active session by IP
        try:
            from ..models import ActiveSession
            
            # Remove any existing session for this user from this IP
            ActiveSession.objects.filter(
                ip_address=ip_address,
                user=user
            ).delete()
            
            # Create new active session record
            ActiveSession.objects.create(
                ip_address=ip_address,
                user=user,
                session_key=session_key,
                user_agent=user_agent
            )
            
            logger.info(f"Active session created for user {user.email} from IP {ip_address}")
            
        except Exception as e:
            logger.error(f"Error creating active session record: {e}")
        
        # Only update user model if this is the first session for this user
        # or if we're replacing an existing session (single-session-per-user)
        if not user.current_session_key:
            user.set_session(session_key)
        else:
            # Clear the old session from the database
            old_session_key = user.current_session_key
            try:
                Session.objects.filter(session_key=old_session_key).delete()
                logger.info(f"Old session {old_session_key} deleted for user {user.email}")
            except Exception as e:
                logger.error(f"Error deleting old session {old_session_key}: {e}")
            
            # Set new session
            user.set_session(session_key)
        
        logger.info(f"New session created for user {user.email} with key {session_key}")
        return session_key
    
    @staticmethod
    def clear_user_session(user, request=None):
        """
        Clear user's session data both from user model and session store
        """
        session_key = user.current_session_key
        
        # Clear from user model
        user.clear_session()
        
        # Clear from session store if session key exists
        if session_key:
            try:
                Session.objects.filter(session_key=session_key).delete()
                logger.info(f"Session {session_key} deleted from store for user {user.email}")
            except Exception as e:
                logger.error(f"Error deleting session {session_key} for user {user.email}: {e}")
        
        # Clear active session records
        try:
            from ..models import ActiveSession
            if request:
                ip_address = get_client_ip(request)
                ActiveSession.objects.filter(
                    ip_address=ip_address,
                    user=user
                ).delete()
                logger.info(f"Active session cleared for user {user.email} from IP {ip_address}")
            else:
                # Clear all active sessions for this user
                ActiveSession.objects.filter(user=user).delete()
                logger.info(f"All active sessions cleared for user {user.email}")
        except Exception as e:
            logger.error(f"Error clearing active session records for user {user.email}: {e}")
        
        # Clear current request session if provided
        if request and hasattr(request, 'session'):
            try:
                request.session.flush()
                logger.info(f"Request session flushed for user {user.email}")
            except Exception as e:
                logger.error(f"Error flushing request session for user {user.email}: {e}")
    
    @staticmethod
    def get_user_from_session(request):
        """
        Get user from session data
        Returns user object if found, None otherwise
        """
        try:
            user_id = request.session.get('user_id')
            if user_id:
                from ..models import CustomUser
                return CustomUser.objects.get(id=user_id)
        except Exception as e:
            logger.error(f"Error getting user from session: {e}")
        return None
    
    @staticmethod
    def check_current_authentication(request):
        """
        Check if user is already authenticated in current session
        Returns (is_authenticated, user, error_response) tuple
        """
        try:
            # First check IP-based session blocking
            has_ip_session, existing_user, ip_message = SessionManager.check_ip_based_session(request)
            if has_ip_session:
                from rest_framework.response import Response
                from rest_framework import status
                error_response = Response({
                    "error": ip_message,
                    "ip_blocked": True,
                    "existing_user": {
                        "email": existing_user.email,
                        "name": f"{existing_user.first_name} {existing_user.last_name}".strip(),
                        "role": existing_user.role
                    }
                }, status=status.HTTP_409_CONFLICT)
                return True, existing_user, error_response
            
            # Then check session data
            session_user = SessionManager.get_user_from_session(request)
            if session_user:
                from rest_framework.response import Response
                from rest_framework import status
                error_response = Response({
                    "error": f"You are already logged in as {session_user.email}. Please logout first before logging in with a different account.",
                    "already_authenticated": True,
                    "current_user": {
                        "email": session_user.email,
                        "name": f"{session_user.first_name} {session_user.last_name}".strip(),
                        "role": session_user.role
                    }
                }, status=status.HTTP_409_CONFLICT)
                return True, session_user, error_response
            
            # Also check JWT token as fallback
            from rest_framework_simplejwt.authentication import JWTAuthentication
            jwt_auth = JWTAuthentication()
            auth_result = jwt_auth.authenticate(request)
            if auth_result:
                current_user, token = auth_result
                from rest_framework.response import Response
                from rest_framework import status
                error_response = Response({
                    "error": f"You are already logged in as {current_user.email}. Please logout first before logging in with a different account.",
                    "already_authenticated": True,
                    "current_user": {
                        "email": current_user.email,
                        "name": f"{current_user.first_name} {current_user.last_name}".strip(),
                        "role": current_user.role
                    }
                }, status=status.HTTP_409_CONFLICT)
                return True, current_user, error_response
                
        except Exception as e:
            logger.warning(f"Error checking current authentication: {e}")
        
        return False, None, None
    
    @staticmethod
    def validate_session_middleware(user, request):
        """
        Middleware validation to check if user's session is still valid
        Returns True if session is valid, False otherwise
        """
        # Check if session has user data
        session_user_id = request.session.get('user_id')
        if not session_user_id:
            return False
        
        # Check if session user matches the authenticated user
        if session_user_id != user.id:
            logger.warning(f"Session user mismatch. Session user: {session_user_id}, Auth user: {user.id}")
            return False
        
        # Check if user has a current session key (for single-session enforcement)
        if user.current_session_key:
            current_session_key = request.session.session_key
            
            # If no current session key, user needs to login again
            if not current_session_key:
                return False
            
            # If session keys don't match, user logged in elsewhere
            if user.current_session_key != current_session_key:
                logger.warning(f"Session key mismatch for user {user.email}. Expected: {user.current_session_key}, Got: {current_session_key}")
                return False
            
            # Check if session is expired (5 minutes for force-close scenarios)
            if not user.is_session_active():
                logger.info(f"Session expired for user {user.email}")
                user.clear_session()
                return False
        else:
            # User has no current session key but has valid JWT token
            # This can happen after account deletion/recreation
            # Allow the request to proceed and let the login process create a new session
            logger.info(f"User {user.email} has valid JWT but no session key - allowing request to proceed")
            return True
        
        return True
    
    @staticmethod
    def cleanup_expired_sessions():
        """
        Cleanup expired sessions from user models
        This can be called periodically via a management command or celery task
        """
        from ..models import CustomUser
        
        expired_users = CustomUser.objects.filter(
            session_created_at__lt=timezone.now() - timedelta(minutes=5)
        ).exclude(current_session_key__isnull=True)
        
        count = 0
        for user in expired_users:
            user.clear_session()
            count += 1
        
        logger.info(f"Cleaned up {count} expired sessions")
        return count
