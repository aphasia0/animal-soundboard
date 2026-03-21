// Cross-domain cookie utilities for Supabase session sharing
// Allows sharing authentication across *.antoniogiordano.dev

const COOKIE_NAME = 'sb-session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export function getRootDomain() {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    
    // If it's a localhost or IP, don't set cross-domain cookie
    if (hostname === 'localhost' || hostname === '127.0.0.1' || parts.length < 2) {
        return hostname;
    }
    
    // For *.antoniogiordano.dev, return .antoniogiordano.dev
    if (parts.length >= 2 && parts.slice(-2).join('.') === 'antoniogiordano') {
        return `.${parts.slice(-2).join('.')}`;
    }
    
    // For other domains with subdomains, return the root domain
    if (parts.length >= 3) {
        return `.${parts.slice(-2).join('.')}`;
    }
    
    return hostname;
}

export function setSessionCookie({ accessToken, refreshToken, expiresAt }) {
    if (!accessToken) return;
    
    const rootDomain = getRootDomain();
    
    const cookieValue = btoa(JSON.stringify({ accessToken, refreshToken, expiresAt }));
    
    const cookieString = [
        `${COOKIE_NAME}=${encodeURIComponent(cookieValue)}`,
        `path=/`,
        `max-age=${COOKIE_MAX_AGE}`,
        `SameSite=Lax`,
        rootDomain !== window.location.hostname ? `domain=${rootDomain}` : ''
    ].filter(Boolean).join('; ');
    
    document.cookie = cookieString;
}

export function getSessionCookie() {
    const cookies = document.cookie.split(';');
    
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === COOKIE_NAME) {
            try {
                return JSON.parse(atob(decodeURIComponent(value)));
            } catch {
                return null;
            }
        }
    }
    
    return null;
}

export function clearSessionCookie() {
    const rootDomain = getRootDomain();
    
    // Clear with all possible domain variations
    const domains = [
        rootDomain,
        window.location.hostname
    ].filter((v, i, a) => v && a.indexOf(v) === i);
    
    for (const domain of domains) {
        document.cookie = [
            `${COOKIE_NAME}=`,
            'path=/',
            'max-age=0',
            'SameSite=Lax',
            domain !== window.location.hostname ? `domain=${domain}` : ''
        ].filter(Boolean).join('; ');
    }
}

export function hasSharedSession() {
    return getSessionCookie() !== null;
}
