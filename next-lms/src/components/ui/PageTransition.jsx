'use client';

import { usePathname } from 'next/navigation';

export default function PageTransition({ children }) {
    const pathname = usePathname();

    return (
        <>
            <div
                key={pathname}
                className="motion-reduce:transition-none"
                style={{ animation: 'page-fade-in 500ms ease-out' }}
            >
                {children}
            </div>
            <style jsx>{`
                @keyframes page-fade-in {
                    from {
                        opacity: 0;
                    }
                    to {
                        opacity: 1;
                    }
                }
            `}</style>
        </>
    );
}
