'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminLmsDashboard from '@/components/layout/AdminLmsDashboard';

const initialForm = {
    categoryName: '',
    codeName: '',
    categoryDetail: '',
    isPublic: true,
    mainCategory: '',
};

export default function CategoryPage() {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState(initialForm);

    const loadCategories = async () => {
        try {
            const res = await fetch('/api/categories');
            if (res.ok) {
                const data = await res.json();
                setCategories(data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        loadCategories();
    }, []);

    const categoryMap = useMemo(() => {
        const map = new Map();
        categories.forEach((cat) => map.set(cat.id, cat.name));
        return map;
    }, [categories]);

    const handleChange = (field, value) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.categoryName.trim()) return;
        setLoading(true);
        try {
            const isEdit = Boolean(editingCategory);
            const endpoint = isEdit ? `/api/categories?id=${editingCategory.id}` : '/api/categories';
            const res = await fetch(endpoint, {
                method: isEdit ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (!res.ok) {
                alert(data.error || 'Save category failed');
                return;
            }
            setFormData(initialForm);
            setEditingCategory(null);
            setShowCreateForm(false);
            await loadCategories();
        } catch (e) {
            alert(e.message);
        }
        setLoading(false);
    };

    const handleDelete = async (id) => {
        if (!confirm('ลบหมวดหมู่นี้?')) return;
        try {
            const res = await fetch(`/api/categories?id=${id}`, { method: 'DELETE' });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                alert(data.error || 'Delete category failed');
                return;
            }
            await loadCategories();
        } catch (e) {
            alert(e.message);
        }
    };

    const handleCancel = () => {
        setFormData(initialForm);
        setEditingCategory(null);
        setShowCreateForm(false);
    };

    const handleEdit = (cat) => {
        setEditingCategory(cat);
        setFormData({
            categoryName: cat.name || '',
            codeName: cat.codeName || '',
            categoryDetail: cat.detail || '',
            isPublic: cat.isPublic ?? true,
            mainCategory: cat.parentId ? String(cat.parentId) : '',
        });
        setShowCreateForm(true);
    };

    if (!showCreateForm) {
        return (
            <AdminLmsDashboard>
                <div className="w-full flex flex-col gap-6 font-['Outfit',sans-serif]">
                    <h1 className="text-[28px] font-medium text-[#052143] leading-[150%]">Category</h1>
                    <hr className="border-gray-200" />

                    <div className="bg-white border border-[#D1E3FB] rounded-[8px] flex flex-col w-full overflow-hidden shadow-sm">
                        <div className="bg-[#687EFF] px-4 py-3 flex items-center justify-between text-white font-medium text-[15px]">
                            <div className="flex items-center gap-2">Category</div>
                            <button
                                onClick={() => setShowCreateForm(true)}
                                className="text-white hover:bg-white/20 w-7 h-7 rounded flex items-center justify-center transition-colors text-xl leading-none font-bold"
                            >
                                +
                            </button>
                        </div>

                        <div className="p-4 flex flex-col gap-2">
                            {categories.length === 0 && (
                                <p className="text-gray-400 text-[14px] italic py-4 text-center">No categories yet.</p>
                            )}
                            {categories.map((cat) => (
                                <div key={cat.id} className="flex items-center justify-between py-2 px-2 hover:bg-gray-50 rounded transition-colors">
                                    <div className="min-w-0">
                                        <div className="text-[14px] text-[#334155] font-medium">{cat.name}</div>
                                        <div className="text-[12px] text-gray-500">
                                            {cat.parentId ? `Main: ${categoryMap.get(cat.parentId) || '-'}` : 'Root Category'}
                                            {' • '}
                                            {cat.isPublic ? 'Public' : 'UnPublic'}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleEdit(cat)}
                                        className="p-1 hover:text-[#F0AD4E] text-gray-500 transition-colors"
                                        title="Edit"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(cat.id)}
                                        className="p-1 hover:text-[#D9534F] text-gray-500 transition-colors"
                                        title="Delete"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </AdminLmsDashboard>
        );
    }

    return (
        <AdminLmsDashboard>
            <div className="w-full flex flex-col gap-6 font-['Outfit',sans-serif]">
                <h1 className="text-[28px] font-medium text-[#052143] leading-[150%]">{editingCategory ? 'Category Edit' : 'Category Create'}</h1>
                <div className="bg-white border border-[#D1E3FB] rounded-[8px] flex flex-col w-full overflow-hidden shadow-sm">
                    <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <label className="text-[#334155] font-semibold text-[14px] sm:w-[160px] shrink-0 sm:text-right">Code Name</label>
                            <input
                                type="text"
                                value={formData.codeName}
                                onChange={(e) => handleChange('codeName', e.target.value)}
                                className="flex-1 max-w-[420px] border border-gray-300 rounded px-3 py-2 text-[14px] text-[#334155] outline-none focus:border-[#687EFF] transition-colors"
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <label className="text-[#334155] font-semibold text-[14px] sm:w-[160px] shrink-0 sm:text-right">Category Name</label>
                            <input
                                type="text"
                                value={formData.categoryName}
                                onChange={(e) => handleChange('categoryName', e.target.value)}
                                className="flex-1 max-w-[420px] border border-gray-300 rounded px-3 py-2 text-[14px] text-[#334155] outline-none focus:border-[#687EFF] transition-colors"
                                required
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                            <label className="text-[#334155] font-semibold text-[14px] sm:w-[160px] shrink-0 sm:text-right pt-2">Category Detail</label>
                            <textarea
                                value={formData.categoryDetail}
                                onChange={(e) => handleChange('categoryDetail', e.target.value)}
                                rows={6}
                                className="flex-1 max-w-[600px] border border-gray-300 rounded px-3 py-2 text-[14px] text-[#334155] outline-none focus:border-[#687EFF] transition-colors resize-y"
                                placeholder="Enter category details..."
                            />
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <label className="text-[#334155] font-semibold text-[14px] sm:w-[160px] shrink-0 sm:text-right">Public</label>
                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 cursor-pointer text-[14px] text-[#334155]">
                                    <input
                                        type="radio"
                                        name="isPublic"
                                        checked={formData.isPublic === true}
                                        onChange={() => handleChange('isPublic', true)}
                                        className="w-4 h-4 cursor-pointer accent-[#687EFF]"
                                    />
                                    Public
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer text-[14px] text-[#334155]">
                                    <input
                                        type="radio"
                                        name="isPublic"
                                        checked={formData.isPublic === false}
                                        onChange={() => handleChange('isPublic', false)}
                                        className="w-4 h-4 cursor-pointer accent-[#687EFF]"
                                    />
                                    UnPublic
                                </label>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <label className="text-[#334155] font-semibold text-[14px] sm:w-[160px] shrink-0 sm:text-right">Main Category</label>
                            <select
                                value={formData.mainCategory}
                                onChange={(e) => handleChange('mainCategory', e.target.value)}
                                className="flex-1 max-w-[420px] border border-gray-300 rounded px-3 py-2 text-[14px] text-[#334155] outline-none focus:border-[#687EFF] bg-white cursor-pointer transition-colors"
                            >
                                <option value="">-- None (Root Category) --</option>
                                {categories.filter((cat) => !editingCategory || cat.id !== editingCategory.id).map((cat) => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex items-center gap-3 sm:ml-[168px] pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-[#687EFF] hover:bg-[#5a6be0] text-white px-5 py-2 rounded text-[14px] font-medium transition-colors shadow-sm disabled:opacity-50"
                            >
                                {loading ? 'Saving...' : editingCategory ? 'Update' : 'Submit'}
                            </button>
                            <button
                                type="button"
                                onClick={handleCancel}
                                className="bg-white hover:bg-gray-50 text-[#334155] border border-gray-300 px-5 py-2 rounded text-[14px] font-medium transition-colors shadow-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </AdminLmsDashboard>
    );
}

