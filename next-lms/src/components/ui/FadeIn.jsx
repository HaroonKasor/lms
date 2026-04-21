'use client';

import React, { useEffect, useRef, useState } from 'react';

const FadeIn = ({ children, delay = 0, direction = 'up', className = '' }) => {
    const [isVisible, setIsVisible] = useState(false);
    const domRef = useRef();

    useEffect(() => {
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    if (domRef.current) observer.unobserve(domRef.current);
                }
            });
        }, { threshold: 0.1 });

        const { current } = domRef;
        if (current) observer.observe(current);
        return () => current && observer.unobserve(current);
    }, []);

    const directionClasses = {
        up: 'translate-y-10',
        down: '-translate-y-10',
        // Use vertical offset for horizontal variants to avoid layout overflow on narrow viewports.
        left: 'translate-y-8',
        right: 'translate-y-8',
        none: '',
    };

    return (
        <div
            ref={domRef}
            style={{ transitionDelay: `${delay}ms` }}
            className={`transition-all duration-1000 ease-out ${isVisible ? 'opacity-100 translate-y-0 translate-x-0' : `opacity-0 ${directionClasses[direction]}`} ${className}`}
        >
            {children}
        </div>
    );
};

export default FadeIn;
