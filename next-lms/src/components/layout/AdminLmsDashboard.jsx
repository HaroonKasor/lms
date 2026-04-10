'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    CartesianGrid
} from 'recharts';

// --- Default/Fallback Data ---
const DEFAULT_AVATAR_URL = '/images/default-avatar.svg';

const defaultUserChartData = [
    { name: 'AUG', value: 70 },
    { name: 'SEP', value: 60 },
    { name: 'OCT', value: 80 },
    { name: 'NOV', value: 160 },
    { name: 'DEC', value: 350 },
    { name: 'JAN', value: 230 },
];

const defaultGraduateChartData = [
    { name: 'AUG', value: 70 },
    { name: 'SEP', value: 60 },
    { name: 'OCT', value: 80 },
    { name: 'NOV', value: 160 },
    { name: 'DEC', value: 350 },
    { name: 'JAN', value: 230 },
];

const defaultTaskList = [
    { id: 1, title: '0 enrollment approvals pending', href: '/admin-dashboard/learn/enrollment' },
    { id: 2, title: '0 certificate approvals pending', href: '/admin-dashboard/report/certificate-report' },
    { id: 3, title: '0 active users', href: '/admin-dashboard/manage-user/users' },
    { id: 4, title: '0 learners currently studying', href: '/admin-dashboard/learn/learner-status' },
];

const defaultActivityList = [
    { id: 1, name: 'Alisa Manama', detail: 'Finished Graphic Design Chapter 1', time: '2 days ago', img: DEFAULT_AVATAR_URL },
    { id: 2, name: 'Alisa Manama', detail: 'Finished Graphic Design Chapter 1', time: '2 days ago', img: DEFAULT_AVATAR_URL },
];

const baseMenuItems = [
    { name: 'Dashboard', path: '/admin-dashboard', matchPrefix: '/admin-dashboard' },
    { name: 'Group', path: '/admin-dashboard/group', matchPrefix: '/admin-dashboard/group' },
    {
        name: 'Manage User',
        hasSub: true,
        matchPrefix: '/admin-dashboard/manage-user',
        subItems: [
            { name: 'Users', path: '/admin-dashboard/manage-user/users', matchPrefix: '/admin-dashboard/manage-user' }
        ]
    },
    {
        name: 'Learn',
        hasSub: true,
        matchPrefix: '/admin-dashboard/learn',
        subItems: [
            { name: 'Category', path: '/admin-dashboard/learn/category', matchPrefix: '/admin-dashboard/learn/category' },
            { name: 'Course', path: '/admin-dashboard/learn/course', matchPrefix: '/admin-dashboard/learn/course' },
            { name: 'Enrollment', path: '/admin-dashboard/learn/enrollment', matchPrefix: '/admin-dashboard/learn/enrollment' },
            { name: 'Batch Enrollment', path: '/admin-dashboard/learn/batch-enrollment', matchPrefix: '/admin-dashboard/learn/batch-enrollment' },
            { name: 'Learner Status', path: '/admin-dashboard/learn/learner-status', matchPrefix: '/admin-dashboard/learn/learner-status' },
        ]
    },
    { name: 'Content', path: '/admin-dashboard/content', matchPrefix: '/admin-dashboard/content' },
    {
        name: 'e-Publication',
        hasSub: true,
        matchPrefix: '/admin-dashboard/e-publication',
        subItems: [
            { name: 'Overview', path: '/admin-dashboard/e-publication', matchPrefix: '/admin-dashboard/e-publication' }
        ]
    },
    {
        name: 'Connection',
        hasSub: true,
        matchPrefix: '/admin-dashboard/connection',
        subItems: [
            { name: 'Overview', path: '/admin-dashboard/connection', matchPrefix: '/admin-dashboard/connection' }
        ]
    },
    {
        name: 'Report',
        hasSub: true,
        matchPrefix: '/admin-dashboard/report',
        subItems: [
            { name: 'Learner Status', path: '/admin-dashboard/report/learner-status', matchPrefix: '/admin-dashboard/report/learner-status' },
            { name: 'Attempt report', path: '/admin-dashboard/report/attempt-report', matchPrefix: '/admin-dashboard/report/attempt-report' },
            { name: 'Examination Score', path: '/admin-dashboard/report/examination-score', matchPrefix: '/admin-dashboard/report/examination-score' },
            { name: 'Certificate Report', path: '/admin-dashboard/report/certificate-report', matchPrefix: '/admin-dashboard/report/certificate-report' }
        ]
    },
];

// --- SVG Icons ---
const ChevronDown = ({ className }) => (
    <svg className={`w-3 h-2 ml-auto shrink-0 ${className || 'text-[#052143]'}`} fill="none" viewBox="0 0 11 6">
        <path fill="currentColor" d="M5.5 6L0 0h11L5.5 6z" />
    </svg>
);

const MenuIcon = () => (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

// --- Custom Components ---

function DropdownFilter() {
    return (
        <div className="flex items-center justify-between px-3 py-1 border border-[#6B778B] rounded-full bg-white h-[26px] cursor-pointer shrink-0">
            <span className="text-[14px] text-[#6B778B] font-normal leading-[130%]">Last 6 months</span>
            <svg className="w-3 h-3 ml-2 text-[#6B778B]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M7 10l5 5 5-5z" />
            </svg>
        </div>
    );
}

function formatRelativeTime(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return '-';
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
    const years = Math.floor(months / 12);
    return `${years} year${years > 1 ? 's' : ''} ago`;
}



export default function AdminLmsDashboard({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const showDefaultDashboard = !children;
    const [stats, setStats] = useState({
        totals: {
            users: 806,
            activeUsers: 102,
            completedEnrollments: 12258,
        },
        trend: {
            users: defaultUserChartData,
            graduates: defaultGraduateChartData,
        },
        recentStatements: [],
    });
    const [auditNav, setAuditNav] = useState({ allowed: false, showInMenu: false });

    // Track multiple expanded menus
    const [expandedMenus, setExpandedMenus] = useState([]);

    const menuItems = React.useMemo(() => {
        const cloned = baseMenuItems.map((item) => ({
            ...item,
            subItems: Array.isArray(item.subItems) ? [...item.subItems] : item.subItems,
        }));
        if (!(auditNav.allowed && auditNav.showInMenu)) return cloned;

        return cloned.map((item) => {
            if (item.name !== 'Report') return item;
            const subItems = Array.isArray(item.subItems) ? [...item.subItems] : [];
            const exists = subItems.some((sub) => String(sub?.path || '') === '/admin-dashboard/report/audit-log');
            if (!exists) {
                subItems.push({
                    name: 'Audit Log',
                    path: '/admin-dashboard/report/audit-log',
                    matchPrefix: '/admin-dashboard/report/audit-log',
                });
            }
            return { ...item, subItems };
        });
    }, [auditNav.allowed, auditNav.showInMenu]);

    const isSubItemActive = React.useCallback((subItem) => {
        const rawPath = String(subItem?.path || '').trim();
        if (!rawPath) return false;

        const [basePath, queryString = ''] = rawPath.split('?');
        const matchPrefix = String(subItem?.matchPrefix || basePath).trim();
        const matchesPath = queryString
            ? pathname === basePath
            : pathname === basePath || pathname.startsWith(`${matchPrefix}/`);

        if (!matchesPath) return false;

        const expectedParams = new URLSearchParams(queryString);
        const expectedView = expectedParams.get('view');
        const currentView = searchParams?.get('view');

        if (expectedView === null) {
            // Default route (no view) should not collide with view-specific links.
            return !currentView;
        }
        return currentView === expectedView;
    }, [pathname, searchParams]);

    // Initialize expanded menu based on current path ONLY after mount to avoid hydration mismatch
    React.useEffect(() => {
        const activeMenu = menuItems.find(item =>
            item.subItems?.some((sub) => isSubItemActive(sub))
        );
        if (activeMenu) {
            setExpandedMenus(prev => prev.includes(activeMenu.name) ? prev : [...prev, activeMenu.name]);
        }
    }, [isSubItemActive, menuItems]); // Keep in sync with route + query changes

    React.useEffect(() => {
        let active = true;
        const loadAuditNav = async () => {
            try {
                const res = await fetch('/api/admin/audit/access', {
                    cache: 'no-store',
                });
                const data = await res.json().catch(() => ({}));
                if (!active || !res.ok) return;
                setAuditNav({
                    allowed: Boolean(data?.allowed),
                    showInMenu: Boolean(data?.showInMenu),
                });
            } catch {
                // ignore menu failures
            }
        };
        loadAuditNav();
        return () => {
            active = false;
        };
    }, []);

    React.useEffect(() => {
        if (!showDefaultDashboard) return undefined;

        let active = true;
        const loadStats = async () => {
            try {
                const res = await fetch('/api/admin/stats', { cache: 'no-store' });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) return;
                if (!active) return;
                setStats({
                    totals: data?.totals || {},
                    trend: data?.trend || {},
                    recentStatements: Array.isArray(data?.recentStatements) ? data.recentStatements : [],
                });
            } catch (error) {
                console.error('[AdminLmsDashboard] load stats failed', error);
            }
        };

        loadStats();
        return () => {
            active = false;
        };
    }, [showDefaultDashboard]);

    React.useEffect(() => {
        setIsHydrated(true);
    }, []);

    const userChartData = React.useMemo(() => {
        const series = Array.isArray(stats?.trend?.users) ? stats.trend.users : [];
        return series.length > 0 ? series : defaultUserChartData;
    }, [stats]);

    const graduateChartData = React.useMemo(() => {
        const series = Array.isArray(stats?.trend?.graduates) ? stats.trend.graduates : [];
        return series.length > 0 ? series : defaultGraduateChartData;
    }, [stats]);

    const taskList = React.useMemo(() => {
        const users = Number(stats?.totals?.users || 0);
        const activeUsers = Number(stats?.totals?.activeUsers || 0);
        const learning = Number(stats?.totals?.learningEnrollments || 0);
        const pendingEnrollmentApprovals = Number(stats?.totals?.pendingEnrollmentApprovals || 0);
        const pendingCertificateApprovals = Number(stats?.totals?.pendingCertificateApprovals || 0);

        if (
            users <= 0 &&
            activeUsers <= 0 &&
            learning <= 0 &&
            pendingEnrollmentApprovals <= 0 &&
            pendingCertificateApprovals <= 0
        ) {
            return defaultTaskList;
        }

        return [
            { id: 1, title: `${pendingEnrollmentApprovals.toLocaleString()} enrollment approvals pending`, href: '/admin-dashboard/learn/enrollment' },
            { id: 2, title: `${pendingCertificateApprovals.toLocaleString()} certificate approvals pending`, href: '/admin-dashboard/report/certificate-report' },
            { id: 3, title: `${activeUsers.toLocaleString()} active users`, href: '/admin-dashboard/manage-user/users' },
            { id: 4, title: `${learning.toLocaleString()} learners currently studying`, href: '/admin-dashboard/learn/learner-status' },
        ];
    }, [stats]);

    const activityList = React.useMemo(() => {
        const statements = Array.isArray(stats?.recentStatements) ? stats.recentStatements : [];
        if (statements.length === 0) return defaultActivityList.slice(0, 3);

        return statements.slice(0, 3).map((row, index) => ({
            id: index + 1,
            name: String(row?.actorName || 'Learner'),
            detail: `${String(row?.verbDisplay || '').trim()} ${String(row?.objectName || '').trim()}`.trim(),
            time: isHydrated ? formatRelativeTime(row?.timestamp) : '-',
            img: String(row?.avatar || '').trim() || DEFAULT_AVATAR_URL,
        }));
    }, [stats, isHydrated]);

    const toggleSubMenu = (menuName) => {
        setExpandedMenus(prev =>
            prev.includes(menuName)
                ? prev.filter(name => name !== menuName)
                : [...prev, menuName]
        );
    };

    React.useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    const renderSidebar = () => (
        <aside className="flex flex-col items-start px-[16px] pt-[16px] pb-[24px] gap-[8px] w-full md:w-[190px] max-w-[280px] min-h-[480px] h-fit bg-[#FFFFFF] rounded-[16px] shadow-sm shrink-0 border border-[#D1E3FB]">
            {menuItems.map((item, idx) => {
                const isChildActive = item.subItems?.some((sub) => isSubItemActive(sub));
                const matchPrefix = String(item?.matchPrefix || item?.path || '').trim();
                const isExactDashboard = matchPrefix === '/admin-dashboard' && pathname === '/admin-dashboard';
                const isActive = isExactDashboard || (matchPrefix && matchPrefix !== '/admin-dashboard' && pathname.startsWith(matchPrefix)) || item.active || isChildActive;
                const isExpanded = expandedMenus.includes(item.name);
                const showAsActiveParent = isExpanded || isActive;

                return (
                    <React.Fragment key={idx}>
                        {item.hasSub ? (
                            <div className="w-full flex flex-col">
                                <button
                                    onClick={() => toggleSubMenu(item.name)}
                                    className={`flex items-center px-3 h-[38px] w-full transition-all ${showAsActiveParent
                                        ? 'bg-[#687EFF] text-white shadow-[0px_4px_10px_rgba(104,126,255,0.2)]'
                                        : 'text-[#6B778B] hover:bg-blue-50'
                                        } rounded-lg`}
                                >
                                    <span className={`text-[15px] font-medium leading-[150%] flex-1 text-left ${showAsActiveParent ? 'text-white' : 'text-[#6B778B]'}`}>
                                        {item.name}
                                    </span>
                                    <div className={`transition-transform duration-200 flex items-center justify-center ${isExpanded ? 'rotate-180' : ''}`}>
                                        <ChevronDown className={showAsActiveParent ? 'text-white' : 'text-[#6B778B]'} />
                                    </div>
                                </button>

                                {isExpanded && item.subItems && (
                                    <div className="flex flex-col w-full mt-1">
                                        {item.subItems.map((sub, sIdx) => {
                                            const isSubActive = isSubItemActive(sub);
                                            return (
                                                <Link
                                                    href={sub.path || '#'}
                                                    key={sIdx}
                                                    className={`flex items-center px-3 py-2 w-full transition-colors rounded-lg mb-0.5 ${isSubActive
                                                        ? 'bg-[#E4E9FF] text-[#6B778B] font-medium'
                                                        : 'bg-transparent text-[#6B778B] hover:bg-[#E4E9FF]/40'
                                                        }`}
                                                >
                                                    <span className="pl-4 text-[14px]">{sub.name || sub}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <Link
                                href={item.path || '#'}
                                className={`flex items-center px-3 h-[38px] w-full transition-all rounded-lg ${isActive
                                    ? 'bg-[#687EFF] text-white shadow-[0px_4px_10px_rgba(104,126,255,0.2)]'
                                    : 'text-[#6B778B] hover:bg-blue-50'
                                    }`}
                            >
                                <span className={`text-[15px] font-medium leading-[150%] flex-1 ${isActive ? 'text-white' : 'text-[#6B778B]'}`}>
                                    {item.name}
                                </span>
                                {item.hasSub && <ChevronDown />}
                            </Link>
                        )}
                        {idx !== menuItems.length - 1 && (
                            <div className="w-full mx-auto border-b border-dashed border-[#C7CFDA]/60"></div>
                        )}
                    </React.Fragment>
                );
            })}
        </aside>
    );

    return (
        <div data-admin-shell="true" className="w-full min-h-screen font-outfit overflow-x-hidden relative flex flex-col bg-[#F6F8FF]">

            {/* Global Navbar */}
            <Navbar />

            {/* Background Gradient (simulating the 1428px height from design) */}
            <div
                className="absolute inset-x-0 top-[80px] bottom-0 pointer-events-none"
                style={{
                    background: 'linear-gradient(180deg, #FFFFFF 0%, #F6F8FF 18%, #F6F8FF 100%)',
                    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.3), 0px 1px 3px 1px rgba(0, 0, 0, 0.15)',
                    zIndex: 0
                }}
            >
                <div className="w-full h-full relative mx-auto max-w-[1290px]">
                    {/* Floating Layout Background Container */}
                    {/* Decorative Gradient Blob */}
                    <div className="absolute w-[104px] h-[104px] right-[5%] top-[400px] rounded-full" style={{ background: 'linear-gradient(134.15deg, rgba(247, 13, 197, 0.099) 15.4%, rgba(247, 13, 197, 0) 73.27%)', filter: 'blur(20px)' }}></div>
                </div>
            </div>

            {/* Center Layout for Content */}
            <div className="w-full max-w-[1760px] mx-auto flex flex-1 flex-col md:flex-row relative z-10 px-4 sm:px-6 xl:px-20">

                {/* Mobile Header (Shows only on small screens) */}
                <div className="md:hidden flex items-center justify-between py-4 w-full shrink-0">
                    <h1 className="text-xl font-medium text-[#052143]">Dashboard</h1>
                    <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-gray-600 focus:outline-none shrink-0">
                        <MenuIcon />
                    </button>
                </div>

                {sidebarOpen && (
                    <div className="fixed inset-0 z-40 bg-slate-900/35 md:hidden" onClick={() => setSidebarOpen(false)}>
                        <div className="h-full w-[280px] max-w-[85vw] p-4" onClick={(event) => event.stopPropagation()}>
                            {renderSidebar()}
                        </div>
                    </div>
                )}

                {/* Left Column for Sidebar placement */}
                <div className="hidden md:block w-[190px] shrink-0 pt-6 relative z-20">
                    {renderSidebar()}
                </div>

                {/* Main Content Area */}
                <main className="admin-dashboard-main flex-1 md:pl-6 xl:pl-8 pt-4 sm:pt-6 pb-8 sm:pb-12 w-full max-w-full overflow-x-hidden">
                    {children ? children : (
                        <div className="w-full">
                            <h1 className="hidden md:block text-[32px] font-medium text-[#052143] leading-[150%] mb-8">Dashboard</h1>

                            <div className="flex flex-col gap-8 w-full">

                                {/* Top Row: Tasks & Activities container */}
                                <div className="bg-white border border-[#D1E3FB] rounded-[24px] flex flex-col xl:flex-row p-6 lg:p-8 gap-10">

                                    {/* Tasks Section */}
                                    <div className="flex-1 w-full xl:w-1/2">
                                        <h2 className="text-[22px] font-medium text-[#052143] leading-[150%] mb-6">Tasks</h2>
                                        <div className="flex flex-col">
                                            {taskList.map((task, idx) => (
                                                <div key={task.id} className="flex flex-col w-full">
                                                    <div className="flex items-center gap-4 py-3 w-full">
                                                        <div className="w-4 h-4 rounded-full bg-[#FF8D28] shrink-0"></div>
                                                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center w-full gap-2">
                                                            <span className="text-[18px] font-medium text-[#052143] leading-[150%] flex-1">{task.title}</span>
                                                            <Link href={task.href || '/admin-dashboard'} className="text-[14px] text-[#6155F5] font-medium whitespace-nowrap leading-[130%]">View all</Link>
                                                        </div>
                                                    </div>
                                                    {idx !== taskList.length - 1 && <div className="w-full border-b border-[#D1E3FB]"></div>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Activities Section */}
                                    <div className="flex-1 w-full xl:w-1/2 flex flex-col">
                                        <div className="flex justify-between items-center mb-6">
                                            <h2 className="text-[22px] font-medium text-[#052143] leading-[150%]">Latest Learner Activities</h2>
                                            <a href="#" className="text-[14px] text-[#6155F5] font-medium leading-[130%] shrink-0">View all</a>
                                        </div>
                                        <div className="flex flex-col gap-4">
                                            {activityList.map((act, i) => (
                                                <React.Fragment key={i}>
                                                    <div className="flex items-start gap-4 w-full relative">
                                                        {/* Avatar */}
                                                        <div className="w-[56px] h-[56px] rounded-full border border-[#687EFF] p-[3px] shrink-0">
                                                            <img src={act.img} alt={act.name} className="w-full h-full rounded-full object-cover" />
                                                        </div>

                                                        {/* Details */}
                                                        <div className="flex flex-col flex-1 pt-1 gap-1">
                                                            <div className="flex items-center justify-between">
                                                                <h3 className="text-[16px] font-medium text-[#052143] leading-[150%] bg-gradient-to-r from-[#F5F5FF] to-[#FBFBFF] px-2 py-0.5 rounded-[2px]">{act.name}</h3>
                                                                <span className="text-[14px] font-normal text-[#8E8E93]">{act.time}</span>
                                                            </div>
                                                            <p className="text-[15px] font-normal text-[#6B778B] leading-[150%]">{act.detail}</p>
                                                        </div>
                                                    </div>
                                                    {i !== activityList.length - 1 && <div className="w-full border-b border-[#D1E3FB] my-1"></div>}
                                                </React.Fragment>
                                            ))}
                                        </div>
                                    </div>

                                </div>

                                {/* Middle Row: Summary Cards */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full">
                                    <StatCard
                                        gradient="linear-gradient(180deg, rgba(94, 94, 239, 0.24) 0%, rgba(94, 94, 239, 0) 100%)"
                                        icon={<svg width="24" height="24" fill="none" stroke="#5E5EEF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
                                        value={Number(stats?.totals?.users || 0).toLocaleString()}
                                        label="Total Users"
                                    />
                                    <StatCard
                                        gradient="linear-gradient(180deg, rgba(251, 17, 255, 0.24) 0%, rgba(251, 17, 255, 0) 100%)"
                                        icon={<svg width="24" height="24" fill="none" stroke="#CC11CC" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>}
                                        value={Number(stats?.totals?.activeUsers || 0).toLocaleString()}
                                        label="Active Sessions"
                                    />
                                    <StatCard
                                        gradient="linear-gradient(180deg, rgba(233, 184, 73, 0.17) 0%, rgba(233, 184, 73, 0) 100%)"
                                        icon={<svg width="24" height="24" fill="none" stroke="#B87D20" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>}
                                        value={Number(stats?.totals?.completedEnrollments || 0).toLocaleString()}
                                        label="Graduated the course"
                                    />
                                </div>

                                {/* Bottom Row: Charts */}
                                <div className="bg-white border border-[#D1E3FB] rounded-[24px] flex flex-col xl:flex-row p-6 xl:p-8 gap-8 w-full mb-10">
                                    {/* Left Chart */}
                                    <div className="flex-1 w-full min-w-0">
                                        <div className="flex justify-between items-center mb-6 px-4">
                                            <h2 className="text-[20px] font-medium text-[#052143]">Number of unique users</h2>
                                            <DropdownFilter />
                                        </div>
                                        <div className="h-[280px] w-full relative">
                                            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={180}>
                                                <AreaChart data={userChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="colorUnique" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="rgba(29, 61, 249, 0.5)" />
                                                            <stop offset="50.96%" stopColor="rgba(143, 159, 255, 0.5)" />
                                                            <stop offset="100%" stopColor="#FFFFFF" />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid vertical={false} stroke="transparent" />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#6B778B', fontFamily: 'Outfit' }} />
                                                    <YAxis axisLine={{ stroke: '#E1E5EC' }} tickLine={false} tick={{ fontSize: 13, fill: '#6B778B', fontFamily: 'Outfit' }} ticks={[0, 100, 200, 300, 400]} domain={[0, 400]} />
                                                    <Tooltip />
                                                    <Area
                                                        type="linear"
                                                        dataKey="value"
                                                        stroke="#687EFF"
                                                        strokeWidth={2}
                                                        fill="url(#colorUnique)"
                                                        fillOpacity={0.8}
                                                        activeDot={{ r: 6, fill: '#687EFF', stroke: '#FFF', strokeWidth: 2 }}
                                                        dot={{ r: 5, fill: '#687EFF', stroke: '#FFF', strokeWidth: 1.5 }}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Right Chart */}
                                    <div className="flex-1 w-full min-w-0">
                                        <div className="flex justify-between items-center mb-6 px-4">
                                            <h2 className="text-[20px] font-medium text-[#052143]">Number of course graduates</h2>
                                            <DropdownFilter />
                                        </div>
                                        <div className="h-[280px] w-full relative">
                                            <ResponsiveContainer width="100%" height="100%" minWidth={240} minHeight={180}>
                                                <AreaChart data={graduateChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="colorGrad" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="0%" stopColor="rgba(222, 42, 45, 0.5)" />
                                                            <stop offset="41.83%" stopColor="rgba(255, 93, 97, 0.5)" />
                                                            <stop offset="100%" stopColor="#FFFFFF" />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid vertical={false} stroke="transparent" />
                                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 13, fill: '#6B778B', fontFamily: 'Outfit' }} />
                                                    <YAxis axisLine={{ stroke: '#E1E5EC' }} tickLine={false} tick={{ fontSize: 13, fill: '#6B778B', fontFamily: 'Outfit' }} ticks={[0, 100, 200, 300, 400]} domain={[0, 400]} />
                                                    <Tooltip />
                                                    <Area
                                                        type="linear"
                                                        dataKey="value"
                                                        stroke="#FF383C"
                                                        strokeWidth={2}
                                                        fill="url(#colorGrad)"
                                                        fillOpacity={0.8}
                                                        activeDot={{ r: 6, fill: '#F65559', stroke: '#FFF', strokeWidth: 2 }}
                                                        dot={{ r: 5, fill: '#F65559', stroke: '#FFF', strokeWidth: 1.5 }}
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
            <style jsx global>{`
                .admin-dashboard-main {
                    overflow-x: hidden;
                    min-width: 0;
                }

                .admin-dashboard-main .overflow-x-auto {
                    max-width: 100%;
                    overflow-x: auto;
                    overscroll-behavior-x: contain;
                    -webkit-overflow-scrolling: touch;
                }

                .admin-dashboard-main .overflow-x-auto::-webkit-scrollbar {
                    height: 6px;
                }

                .admin-dashboard-main .overflow-x-auto > table {
                    width: 100% !important;
                    min-width: 100% !important;
                    table-layout: fixed;
                }

                .admin-dashboard-main .overflow-x-auto table th,
                .admin-dashboard-main .overflow-x-auto table td {
                    white-space: normal !important;
                    overflow-wrap: anywhere;
                    word-break: break-word;
                }

                @media (max-width: 767px) {
                    .admin-dashboard-main {
                        padding-top: 10px !important;
                        padding-bottom: 20px !important;
                    }

                    .admin-dashboard-main .overflow-x-auto > table {
                        min-width: 680px !important;
                    }
                }

                @media (max-width: 1023px) {
                    .admin-dashboard-main {
                        padding-left: 0 !important;
                        padding-right: 0 !important;
                    }
                }
            `}</style>
        </div>
    );
}

// --- Subcomponents ---

function StatCard({ gradient, icon, value, label }) {
    return (
        <div className="bg-white border border-[#D1E3FB] rounded-[24px] p-6 flex flex-col justify-between w-full h-[220px] hover:shadow-lg transition-shadow">
            <div
                className="w-[60px] h-[60px] rounded-full flex items-center justify-center relative"
                style={{ background: gradient }}
            >
                <div className="absolute w-[50px] h-[50px] border border-white rounded-[100px] flex items-center justify-center bg-transparent z-10 text-xl drop-shadow-sm">
                    {icon}
                </div>
            </div>

            <div className="flex flex-col w-full gap-3 mt-4">
                <h3 className="text-[32px] font-medium text-[#052143] leading-[1] w-full m-0 p-0 flex items-baseline gap-2">
                    {value} <span className="text-[15px] font-medium opacity-80">{label}</span>
                </h3>
                <div className="w-full h-0 border-t border-[#D1E3FB]"></div>
                <a href="#" className="flex items-center gap-2 text-[#6155F5] text-[13px] font-medium group">
                    View details
                    <span className="text-[#6155F5] group-hover:translate-x-1 transition-transform inline-block font-bold">-&gt;</span>
                </a>
            </div>
        </div>
    );
}

