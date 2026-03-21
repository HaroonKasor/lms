'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LegacySectionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const courseId = String(searchParams.get('lrscourseid') || searchParams.get('courseId') || '').trim();
        const target = courseId
            ? `/admin-dashboard/learn/course?lrscourseid=${encodeURIComponent(courseId)}`
            : '/admin-dashboard/learn/course';
        router.replace(target);
    }, [router, searchParams]);

    return null;
}

