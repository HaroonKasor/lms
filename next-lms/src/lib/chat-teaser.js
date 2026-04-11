const LEARN_ROUTE_PATTERN = /^\/courses\/[^/]+\/learn\/?$/i;

function normalizePath(pathname = '/') {
    const raw = String(pathname || '/').trim();
    if (!raw) return '/';
    const withoutQuery = raw.split('?')[0].split('#')[0] || '/';
    return withoutQuery.startsWith('/') ? withoutQuery : `/${withoutQuery}`;
}

export function buildChatTeaserRouteKey(pathname = '/') {
    const path = normalizePath(pathname);
    if (LEARN_ROUTE_PATTERN.test(path)) return '/courses/:id/learn';
    if (path.startsWith('/courses/')) return '/courses/:id';
    if (path.startsWith('/my-learning')) return '/my-learning';
    if (path.startsWith('/dashboard')) return '/dashboard';
    if (path.startsWith('/products')) return '/products';
    if (path.startsWith('/courses')) return '/courses';
    if (path.startsWith('/about')) return '/about';
    if (path.startsWith('/contact')) return '/contact';
    return path;
}

export function resolveChatTeaserMessage(pathname = '/', isAuthenticated = false) {
    const routeKey = buildChatTeaserRouteKey(pathname);

    if (routeKey === '/dashboard' || routeKey === '/my-learning') {
        return 'Want a quick summary of your learning progress?';
    }
    if (routeKey === '/courses/:id/learn') {
        return 'Need a hint for this lesson?';
    }
    if (routeKey === '/courses' || routeKey === '/courses/:id') {
        return isAuthenticated
            ? 'Need help choosing what to learn next?'
            : 'Need help choosing the right course?';
    }
    if (routeKey === '/products') {
        return 'Need help comparing SkillUp features?';
    }
    if (routeKey === '/about') {
        return 'Ask me about the SkillUp project and team.';
    }
    if (routeKey === '/contact') {
        return 'Need contact information quickly?';
    }
    return isAuthenticated
        ? 'Anything you want help with right now?'
        : 'Have questions? Ask SkillBot anytime.';
}

