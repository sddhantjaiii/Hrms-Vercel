from django.conf import settings
from django.utils.deprecation import MiddlewareMixin
from django.http import HttpResponsePermanentRedirect

class ForceHTTPSMiddleware(MiddlewareMixin):
    """
    Middleware to force HTTPS URLs in responses for production
    """
    
    def process_request(self, request):
        # Force HTTPS scheme detection for Vercel
        if not settings.DEBUG:
            # Always consider requests as secure in production
            request.is_secure = lambda: True
            request.META['wsgi.url_scheme'] = 'https'
            request.META['HTTP_X_FORWARDED_PROTO'] = 'https'
        
        return None
    
    def process_response(self, request, response):
        # Force HTTPS in all response content for API responses
        if not settings.DEBUG and 'application/json' in response.get('Content-Type', ''):
            try:
                content = response.content.decode('utf-8')
                # Replace any HTTP URLs with HTTPS in JSON responses
                content = content.replace('http://', 'https://')
                response.content = content.encode('utf-8')
                response['Content-Length'] = str(len(response.content))
            except:
                pass
        
        # Ensure all Location headers use HTTPS in production
        if not settings.DEBUG and 'Location' in response:
            location = response['Location']
            if location.startswith('http://'):
                response['Location'] = location.replace('http://', 'https://', 1)
        
        # Add security headers to force HTTPS
        if not settings.DEBUG:
            response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
            response['Content-Security-Policy'] = 'upgrade-insecure-requests;'
        
        return response
        # Add security headers to force HTTPS
        if not settings.DEBUG:
            response['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
            response['Content-Security-Policy'] = 'upgrade-insecure-requests;'
        
        return response
