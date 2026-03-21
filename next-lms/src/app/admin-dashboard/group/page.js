'use client';

import React, { useState } from 'react';
import AdminLmsDashboard from '@/components/layout/AdminLmsDashboard';

export default function GroupManagementPage() {
    const [entries, setEntries] = useState(10);
    const [search, setSearch] = useState('');

    const groupData = [
        {
            id: 1,
            name: 'ADMINISTRATOR',
            description: 'ADMINISTRATOR',
            status: true,
            permissions: ['Administrator', 'ผู้ดูแลระบบคลังข้อสอบ', 'ผู้ออกข้อสอบในคลังข้อสอบ', 'เชื่อมข้อมูลจาก AD'],
        },
        {
            id: 2,
            name: 'INSTRUCTOR',
            description: 'INSTRUCTOR',
            status: true,
            permissions: ['DASHBOARD', 'View User'],
        },
        {
            id: 3,
            name: 'LEARNER',
            description: 'LEARNER',
            status: true,
            permissions: ['XAPI', 'Learner'],
        },
        {
            id: 4,
            name: 'TestCRGroup00',
            description: 'LEARNER',
            status: true,
            permissions: [],
        },
    ];

    return (
        <AdminLmsDashboard>
            <div className="w-full flex flex-col gap-6">
                <h1 className="text-[28px] md:text-[32px] font-medium text-[#6B778B] leading-[150%]">จัดการกลุ่มผู้ใช้งาน</h1>

                <div className="bg-white border border-[#D1E3FB] rounded-[8px] flex flex-col w-full overflow-hidden shadow-sm">
                    {/* Header */}
                    <div className="bg-[#687EFF] px-4 py-3 flex items-center justify-between text-white">
                        <div className="flex items-center gap-2 font-medium text-[16px]">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                            จัดการกลุ่มผู้ใช้งาน
                        </div>
                        <button className="text-white hover:bg-white/20 p-1 rounded transition-colors text-xl leading-none">
                            +
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex flex-col p-4 w-full">
                        {/* Table Controls */}
                        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4 text-[#6B778B] text-[15px]">
                            <div className="flex items-center gap-2">
                                <span>แสดง</span>
                                <select
                                    className="border border-gray-300 rounded px-2 py-1 outline-none focus:border-[#687EFF] bg-white h-[34px]"
                                    value={entries}
                                    onChange={(e) => setEntries(Number(e.target.value))}
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
                                </select>
                                <span>รายการ</span>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <span>ค้นหา:</span>
                                <input
                                    type="text"
                                    className="border border-gray-300 rounded px-3 py-1 outline-none focus:border-[#687EFF] w-full sm:w-[200px] h-[34px]"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Table */}
                        <div className="w-full overflow-x-auto border border-gray-200 rounded">
                            <table className="w-full text-left min-w-[800px]">
                                <thead className="bg-[#F8FAFC] border-b border-gray-200 text-[#334155] text-[15px]">
                                    <tr>
                                        <th className="font-semibold p-3 w-[60px] text-center">ลำดับ</th>
                                        <th className="font-semibold p-3 border-l border-gray-200 group cursor-pointer hover:bg-gray-100">
                                            <div className="flex items-center justify-between">
                                                ชื่อกลุ่ม
                                                <div className="flex flex-col opacity-30 text-[10px] leading-tight group-hover:opacity-100">
                                                    <span>▲</span>
                                                    <span>▼</span>
                                                </div>
                                            </div>
                                        </th>
                                        <th className="font-semibold p-3 border-l border-gray-200 group cursor-pointer hover:bg-gray-100">
                                            <div className="flex items-center justify-between">
                                                คำอธิบาย
                                                <div className="flex flex-col opacity-30 text-[10px] leading-tight group-hover:opacity-100">
                                                    <span>▲</span>
                                                    <span>▼</span>
                                                </div>
                                            </div>
                                        </th>
                                        <th className="font-semibold p-3 border-l border-gray-200 w-[80px] text-center group cursor-pointer hover:bg-gray-100">
                                            <div className="flex items-center justify-center gap-1">
                                                สถานะ
                                                <div className="flex flex-col opacity-30 text-[10px] leading-tight group-hover:opacity-100">
                                                    <span>▲</span>
                                                    <span>▼</span>
                                                </div>
                                            </div>
                                        </th>
                                        <th className="font-semibold p-3 border-l border-gray-200 group cursor-pointer hover:bg-gray-100 min-w-[200px]">
                                            <div className="flex items-center justify-between">
                                                สิทธิ์การใช้งาน
                                                <div className="flex flex-col opacity-30 text-[10px] leading-tight group-hover:opacity-100">
                                                    <span>▲</span>
                                                    <span>▼</span>
                                                </div>
                                            </div>
                                        </th>
                                        <th className="font-semibold p-3 border-l border-gray-200 w-[100px] text-center group cursor-pointer hover:bg-gray-100">
                                            <div className="flex items-center justify-center gap-1">
                                                เครื่องมือ
                                                <div className="flex flex-col opacity-30 text-[10px] leading-tight group-hover:opacity-100">
                                                    <span>▲</span>
                                                    <span>▼</span>
                                                </div>
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupData.map((row) => (
                                        <tr key={row.id} className="border-b border-gray-200 hover:bg-gray-50 text-[14px] text-[#475569]">
                                            <td className="p-3 text-center">{row.id}</td>
                                            <td className="p-3 border-l border-gray-200">{row.name}</td>
                                            <td className="p-3 border-l border-gray-200">{row.description}</td>
                                            <td className="p-3 border-l border-gray-200 text-center">
                                                {row.status && (
                                                    <div className="inline-flex items-center justify-center w-5 h-5 bg-[#10B981] rounded-full text-white">
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3 border-l border-gray-200">
                                                {row.permissions.length > 0 && (
                                                    <ul className="list-disc pl-5 m-0 space-y-1">
                                                        {row.permissions.map((perm, i) => (
                                                            <li key={i}>{perm}</li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </td>
                                            <td className="p-3 border-l border-gray-200 text-center">
                                                <div className="flex items-center justify-center gap-2 text-gray-500">
                                                    <button className="hover:text-gray-800 transition-colors" title="View">
                                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M4 6h16v12H4z" opacity="0.2" /><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V6h16v12zM6 10h12v2H6zm0 4h8v2H6z" />
                                                        </svg>
                                                    </button>
                                                    <button className="hover:text-[#687EFF] transition-colors" title="Edit">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                                        </svg>
                                                    </button>
                                                    <button className="hover:text-red-500 transition-colors" title="Delete">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6"></polyline>
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                            <line x1="10" y1="11" x2="10" y2="17"></line>
                                                            <line x1="14" y1="11" x2="14" y2="17"></line>
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4 text-[#6B778B] text-[14px]">
                            <div>แสดง 1 จาก 4 ถึง 4 ข้อมูล</div>
                            <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                                <button className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-400 border-r border-gray-300 disabled:opacity-50" disabled>
                                    &lt;
                                </button>
                                <button className="px-3 py-1.5 bg-gray-100 font-medium text-gray-700">
                                    1
                                </button>
                                <button className="px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-400 border-l border-gray-300 disabled:opacity-50" disabled>
                                    &gt;
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </AdminLmsDashboard>
    );
}

