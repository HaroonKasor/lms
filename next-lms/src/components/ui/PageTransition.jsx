'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function PageTransition({ children }) {
    const pathname = usePathname();
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        setIsVisible(false);
        const rafId = window.requestAnimationFrame(() => setIsVisible(true));
        return () => window.cancelAnimationFrame(rafId);
    }, [pathname]);

    return (
        <div
            className={`transition-opacity duration-500 ease-out motion-reduce:transition-none ${
                isVisible ? 'opacity-100' : 'opacity-0'
            }`}
        >
            {children}
        </div>
    );
}
