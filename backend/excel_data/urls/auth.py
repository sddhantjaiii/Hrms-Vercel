from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from ..views import (
    SystemUserRegistrationView, SystemUserLoginView, SystemUserProfileView,
    LogoutView, ForceLogoutView, TenantSignupView, PublicTenantLoginView,
    VerifyEmailView, ResendVerificationView, CheckVerificationStatusView,
    DeleteAccountView, CleanupTokensView, EnhancedInvitationView,
    AcceptInvitationView, ValidateInvitationTokenView
)

urlpatterns = [
    path('public/signup/', TenantSignupView.as_view(), name='tenant-signup'),
    path('public/login/', PublicTenantLoginView.as_view(), name='public-login'),
    path('auth/register/', SystemUserRegistrationView.as_view(), name='user-register'),
    path('auth/login/', SystemUserLoginView.as_view(), name='user-login'),
    path('auth/logout/', LogoutView.as_view(), name='user-logout'),
    path('auth/force-logout/', ForceLogoutView.as_view(), name='force-logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token-refresh'),

    # Email verification
    path('verify-email/<uuid:token>/', VerifyEmailView.as_view(), name='verify-email'),
    path('resend-verification/', ResendVerificationView.as_view(), name='resend-verification'),
    path('check-verification-status/', CheckVerificationStatusView.as_view(), name='check-verification-status'),

    # Account management
    path('user/delete-account/', DeleteAccountView.as_view(), name='delete-account'),
    path('admin/cleanup-tokens/', CleanupTokensView.as_view(), name='cleanup-tokens'),
    path('user/profile/', SystemUserProfileView.as_view(), name='user-profile'),

    # Invitation management
    path('invitations/send-invitation/', EnhancedInvitationView.as_view(), name='send-invitation'),
    path('accept-invitation/', AcceptInvitationView.as_view(), name='accept-invitation'),
    path('validate-invitation-token/', ValidateInvitationTokenView.as_view(), name='validate-invitation-token'),
]
