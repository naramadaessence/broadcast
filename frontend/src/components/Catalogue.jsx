import { useState, useEffect } from 'preact/hooks';
import { useStore } from '../stores/store';
import Icon from './Icons';

const PRODUCTS_PER_PAGE = 12;

function blankProductForm() {
    return {
        name: '',
        description: '',
        mrp: '',
        selling_price: '',
        category: '',
        sku: '',
        image_url: '',
        images: [],
        inventory_available: true,
        track_inventory: false,
        inventory_quantity: '',
        inventory_policy: 'deny'
    };
}

function stockStatus(product) {
    const isUnavailable = product.inventory_available === false || Number(product.inventory_available) === 0;
    if (isUnavailable) return { label: 'Out of stock', color: '#DC2626', bg: '#FEE2E2' };

    const hasQuantity = product.inventory_quantity !== null && product.inventory_quantity !== undefined && product.inventory_quantity !== '';
    if (!hasQuantity) return { label: 'Available', color: '#047857', bg: '#D1FAE5' };

    const quantity = Number(product.inventory_quantity);
    if (!Number.isFinite(quantity)) return null;

    if (quantity <= 0 && product.inventory_policy === 'continue') {
        return { label: 'Backorder allowed', color: '#1D4ED8', bg: '#DBEAFE' };
    }

    if (quantity <= 5 && product.inventory_policy !== 'continue') {
        return { label: `Only ${product.inventory_quantity} left`, color: '#B45309', bg: '#FEF3C7' };
    }
    return { label: `${product.inventory_quantity} in stock`, color: '#047857', bg: '#D1FAE5' };
}

export default function Catalogue() {
    const { showToast } = useStore();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [syncingMeta, setSyncingMeta] = useState(false);
    const [pushingMeta, setPushingMeta] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState('newest');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);

    const [formData, setFormData] = useState(blankProductForm);

    const api = async (path, options = {}) => {
        const token = localStorage.getItem('narmada_broadcast_token');
        const slug = localStorage.getItem('tenant_slug') || 'default';
        const res = await fetch(`/api/v1${path}`, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                'x-tenant-slug': slug,
                ...options.headers,
            },
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Request failed');
        }
        if (res.status === 204) return null;
        return res.json();
    };

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const data = await api('/products');
            setProducts(data.products || []);
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSyncFromMeta = async () => {
        try {
            setSyncingMeta(true);
            const data = await api('/products/sync-meta', { method: 'POST' });
            showToast(data.message, data.failed > 0 ? 'error' : 'success');
            await fetchProducts();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setSyncingMeta(false);
        }
    };

    const handlePushToMeta = async () => {
        try {
            setPushingMeta(true);
            const data = await api('/products/push-to-meta', { method: 'POST' });
            showToast(data.message, data.failed > 0 ? 'error' : 'success');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setPushingMeta(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, categoryFilter, sortOption]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleTrackInventoryChange = (e) => {
        const checked = e.target.checked;
        setFormData(prev => ({
            ...prev,
            track_inventory: checked,
            inventory_quantity: checked ? prev.inventory_quantity : '',
            inventory_policy: checked ? prev.inventory_policy : 'deny'
        }));
    };

    const handleInventoryPolicyChange = (e) => {
        setFormData(prev => ({
            ...prev,
            inventory_policy: e.target.checked ? 'continue' : 'deny'
        }));
    };

    const handleOpenModal = (product = null) => {
        if (product) {
            setEditingProduct(product);
            let parsedImages = [];
            try {
                if (product.images) parsedImages = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
                if (!parsedImages || parsedImages.length === 0) parsedImages = product.image_url ? [product.image_url] : [];
            } catch { parsedImages = product.image_url ? [product.image_url] : []; }

            const hasTrackedQuantity = product.inventory_quantity !== null && product.inventory_quantity !== undefined && product.inventory_quantity !== '';
            setFormData({
                name: product.name || '',
                description: product.description || '',
                mrp: product.mrp || '',
                selling_price: product.selling_price || '',
                category: product.category || '',
                sku: product.sku || '',
                image_url: product.image_url || '',
                images: parsedImages,
                inventory_available: !(product.inventory_available === false || Number(product.inventory_available) === 0),
                track_inventory: hasTrackedQuantity,
                inventory_quantity: hasTrackedQuantity ? product.inventory_quantity : '',
                inventory_policy: product.inventory_policy || 'deny'
            });
        } else {
            setEditingProduct(null);
            setFormData(blankProductForm());
        }
        setShowModal(true);
    };

    const handleImageUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;

        // Ensure all are images
        if (files.some(f => !f.type.startsWith('image/'))) {
            showToast('Please select only image files', 'error');
            return;
        }

        const token = localStorage.getItem('narmada_broadcast_token');
        const slug = localStorage.getItem('tenant_slug') || 'default';
        const formDataPayload = new FormData();
        files.forEach(file => formDataPayload.append('images', file));

        setUploadingImage(true);
        try {
            const res = await fetch('/api/v1/products/upload-images', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'x-tenant-slug': slug,
                },
                body: formDataPayload
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to upload images');
            }

            const data = await res.json();
            setFormData(prev => {
                const newImages = [...(prev.images || []), ...(data.image_urls || [])];
                return { ...prev, images: newImages, image_url: newImages[0] || '' };
            });
            showToast('Images uploaded successfully');
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setUploadingImage(false);
            e.target.value = '';
        }
    };

    const removeImage = (index) => {
        setFormData(prev => {
            const newImages = [...prev.images];
            newImages.splice(index, 1);
            return { ...prev, images: newImages, image_url: newImages[0] || '' };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                ...formData,
                inventory_quantity: formData.track_inventory ? formData.inventory_quantity : '',
                inventory_policy: formData.inventory_policy === 'continue' ? 'continue' : 'deny',
                inventory_available: Boolean(formData.inventory_available)
            };
            delete payload.track_inventory;

            let response;
            if (editingProduct) {
                response = await api(`/products/${editingProduct.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(payload)
                });
            } else {
                response = await api('/products', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
            }

            // Check if there was a sync error warning in the message
            if (response && response.message && response.message.includes('Facebook Sync Failed')) {
                showToast(response.message, 'error');
            } else {
                showToast(response?.message || 'Product saved successfully');
            }

            setShowModal(false);
            fetchProducts();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        try {
            await api(`/products/${id}`, { method: 'DELETE' });
            showToast('Product deleted');
            fetchProducts();
        } catch (err) {
            showToast(err.message, 'error');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Icon name="loader" size={32} />
                    <p style={{ marginTop: '12px' }}>Loading catalogue...</p>
                </div>
            </div>
        );
    }

    // Client-side filtering + sorting
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    const inventoryManagedByShopify = editingProduct?.external_provider === 'shopify';

    const filteredProducts = products
        .filter(p => {
            const matchesSearch = !searchTerm || p.name?.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) || p.description?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = !categoryFilter || p.category === categoryFilter;
            return matchesSearch && matchesCategory;
        })
        .sort((a, b) => {
            switch (sortOption) {
                case 'name-asc': return (a.name || '').localeCompare(b.name || '');
                case 'name-desc': return (b.name || '').localeCompare(a.name || '');
                case 'price-low': return (parseFloat(a.selling_price) || 0) - (parseFloat(b.selling_price) || 0);
                case 'price-high': return (parseFloat(b.selling_price) || 0) - (parseFloat(a.selling_price) || 0);
                case 'newest': default: return (b.id || 0) - (a.id || 0);
            }
        });

    const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const pageStartIndex = (safeCurrentPage - 1) * PRODUCTS_PER_PAGE;
    const pageEndIndex = Math.min(pageStartIndex + PRODUCTS_PER_PAGE, filteredProducts.length);
    const paginatedProducts = filteredProducts.slice(pageStartIndex, pageStartIndex + PRODUCTS_PER_PAGE);
    const goToPage = (page) => setCurrentPage(Math.min(Math.max(page, 1), totalPages));

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        <Icon name="tag" size={22} style={{ marginRight: '8px' }} />
                        Products Catalogue
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0' }}>
                        {products.length} product{products.length !== 1 ? 's' : ''}
                        {filteredProducts.length !== products.length ? ` · ${filteredProducts.length} shown` : ''}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={handleSyncFromMeta} disabled={syncingMeta || pushingMeta} style={{ gap: '6px', display: 'flex', alignItems: 'center' }}>
                        {syncingMeta ? <Icon name="loader" size={16} /> : <Icon name="download" size={16} />}
                        {syncingMeta ? 'Syncing...' : 'Sync from Meta'}
                    </button>
                    <button className="btn btn-secondary" onClick={handlePushToMeta} disabled={syncingMeta || pushingMeta} title="Queue all local products for WhatsApp customer catalogue visibility" style={{ gap: '6px', display: 'flex', alignItems: 'center' }}>
                        {pushingMeta ? <Icon name="loader" size={16} /> : <Icon name="upload" size={16} />}
                        {pushingMeta ? 'Publishing...' : 'Publish to WhatsApp'}
                    </button>
                    <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ gap: '6px', display: 'flex', alignItems: 'center' }}>
                        <Icon name="plus" size={16} /> Add Product
                    </button>
                </div>
            </div>

            {/* Search + Sort + Filter Bar */}
            {products.length > 0 && (
                <div className="card" style={{ marginBottom: '16px', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
                        {/* Search */}
                        <div className="form-group" style={{ margin: 0, flex: '1 1 220px', minWidth: '180px' }}>
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Search</label>
                            <div style={{ position: 'relative' }}>
                                <Icon name="search" size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                                <input className="form-input" type="text" placeholder="Product name, SKU..." value={searchTerm} onInput={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '32px' }} />
                            </div>
                        </div>

                        {/* Category */}
                        {categories.length > 0 && (
                            <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
                                <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Category</label>
                                <select className="form-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                                    <option value="">All</option>
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        )}

                        {/* Sort */}
                        <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Sort By</label>
                            <select className="form-select" value={sortOption} onChange={e => setSortOption(e.target.value)}>
                                <option value="newest">Newest First</option>
                                <option value="name-asc">Name A → Z</option>
                                <option value="name-desc">Name Z → A</option>
                                <option value="price-low">Price: Low → High</option>
                                <option value="price-high">Price: High → Low</option>
                            </select>
                        </div>

                        {(searchTerm || categoryFilter) && (
                            <button className="btn btn-secondary" onClick={() => { setSearchTerm(''); setCategoryFilter(''); }} style={{ padding: '6px 12px', fontSize: '12px', alignSelf: 'flex-end' }}>
                                <Icon name="x" size={12} /> Reset
                            </button>
                        )}
                    </div>
                </div>
            )}

            {filteredProducts.length === 0 && products.length > 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    <Icon name="search" size={36} style={{ opacity: 0.4 }} />
                    <p style={{ marginTop: '8px' }}>No products match your search</p>
                </div>
            ) : filteredProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                    <Icon name="tag" size={48} strokeWidth={1.5} style={{ opacity: 0.4 }} />
                    <p style={{ marginTop: '12px' }}>No products found in your catalogue.</p>
                    <button className="btn btn-primary" onClick={() => handleOpenModal()} style={{ marginTop: '16px' }}>
                        Create First Product
                    </button>
                </div>
            ) : (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                        {paginatedProducts.map(product => {
                            const stock = stockStatus(product);
                            return (
                        <div
                            key={product.id}
                            className="card"
                            style={{
                                padding: 0,
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                border: '1px solid var(--border)',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 24px -8px rgba(0,0,0,0.12)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'; }}
                        >
                            <div style={{
                                width: '100%',
                                aspectRatio: '1 / 1',
                                position: 'relative',
                                background: 'var(--bg-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden'
                            }}>
                                {/* Blurred Background Layer */}
                                {product.image_url && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '-10%', left: '-10%', right: '-10%', bottom: '-10%',
                                        backgroundImage: `url(${product.image_url})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        filter: 'blur(20px)',
                                        opacity: 0.3,
                                        zIndex: 0
                                    }} />
                                )}

                                {/* Foreground Image */}
                                {product.image_url ? (
                                    <img
                                        src={product.image_url}
                                        alt={product.name}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'contain',
                                            position: 'relative',
                                            zIndex: 1,
                                            padding: '16px' // Breathing room
                                        }}
                                    />
                                ) : (
                                    <Icon name="image" size={40} color="var(--border)" style={{ position: 'relative', zIndex: 1 }} />
                                )}
                            </div>
                            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 600 }}>{product.name}</h3>
                                    {product.selling_price > 0 && (
                                        <span style={{ fontWeight: 700, color: '#10B981', fontSize: '15px' }}>
                                            ₹{product.selling_price}
                                        </span>
                                    )}
                                </div>
                                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 12px 0', flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {product.description || 'No description provided.'}
                                </p>
                                <div style={{ display: 'flex', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', flexWrap: 'wrap' }}>
                                    {product.category && <span style={{ padding: '2px 8px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>{product.category}</span>}
                                    {product.sku && <span style={{ padding: '2px 8px', background: 'var(--bg-secondary)', borderRadius: '12px' }}>SKU: {product.sku}</span>}
                                    {stock && <span style={{ padding: '2px 8px', background: stock.bg, color: stock.color, borderRadius: '12px', fontWeight: 700 }}>{stock.label}</span>}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                                    <button className="btn btn-ghost" onClick={() => handleOpenModal(product)} style={{ flex: 1, padding: '6px' }}>
                                        <Icon name="pencil" size={14} style={{ marginRight: '6px' }} /> Edit
                                    </button>
                                    <button className="btn btn-ghost" onClick={() => handleDelete(product.id)} style={{ flex: 1, padding: '6px', color: '#EF4444' }}>
                                        <Icon name="trash" size={14} style={{ marginRight: '6px' }} /> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                            );
                        })}
                    </div>

                    {filteredProducts.length > PRODUCTS_PER_PAGE && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '20px', padding: '14px 16px', background: 'white', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                Showing {pageStartIndex + 1}-{pageEndIndex} of {filteredProducts.length}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button className="btn btn-secondary" onClick={() => goToPage(safeCurrentPage - 1)} disabled={safeCurrentPage === 1}>Previous</button>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '13px', minWidth: '90px', textAlign: 'center' }}>
                                    Page {safeCurrentPage} of {totalPages}
                                </span>
                                <button className="btn btn-secondary" onClick={() => goToPage(safeCurrentPage + 1)} disabled={safeCurrentPage === totalPages}>Next</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h2>{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
                            <button className="btn-icon" onClick={() => setShowModal(false)}>
                                <Icon name="x" size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <form onSubmit={handleSubmit} id="productForm">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">Product Name *</label>
                                        <input type="text" className="form-input" name="name" value={formData.name} onChange={handleInputChange} required />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">Description</label>
                                        <textarea className="form-input" name="description" value={formData.description} onChange={handleInputChange} rows="3" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Selling Price (₹)</label>
                                        <input type="number" step="0.01" className="form-input" name="selling_price" value={formData.selling_price} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">MRP (₹)</label>
                                        <input type="number" step="0.01" className="form-input" name="mrp" value={formData.mrp} onChange={handleInputChange} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Category</label>
                                        <input type="text" className="form-input" name="category" value={formData.category} onChange={handleInputChange} placeholder="e.g. Electronics, Clothing" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">SKU (Meta Pixel Content ID)</label>
                                        <input type="text" className="form-input" name="sku" value={formData.sku} onChange={handleInputChange} placeholder="Must match website Pixel ID" />
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1', padding: '14px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg-secondary)' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                                            <div>
                                                <label className="form-label" style={{ marginBottom: '4px' }}>Inventory</label>
                                                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
                                                    {inventoryManagedByShopify
                                                        ? 'Managed by Shopify. Run Shopify Sync after changing stock in Shopify.'
                                                        : 'Shown on product cards and used by checkout, Meta catalogue sync, and WhatsApp suggestions.'}
                                                </p>
                                            </div>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                                <input type="checkbox" name="inventory_available" checked={formData.inventory_available} onChange={handleInputChange} disabled={inventoryManagedByShopify} />
                                                Available for sale
                                            </label>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'end' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: inventoryManagedByShopify ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
                                                <input type="checkbox" checked={formData.track_inventory} onChange={handleTrackInventoryChange} disabled={inventoryManagedByShopify} />
                                                Track inventory
                                            </label>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 700, color: formData.track_inventory && !inventoryManagedByShopify ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                                                <input type="checkbox" checked={formData.inventory_policy === 'continue'} onChange={handleInventoryPolicyChange} disabled={!formData.track_inventory || inventoryManagedByShopify} />
                                                Allow orders when out of stock
                                            </label>
                                            <div className="form-group" style={{ margin: 0 }}>
                                                <label className="form-label">Quantity available</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    className="form-input"
                                                    name="inventory_quantity"
                                                    value={formData.inventory_quantity}
                                                    onChange={handleInputChange}
                                                    placeholder="Leave blank if not tracking"
                                                    disabled={!formData.track_inventory || inventoryManagedByShopify}
                                                />
                                            </div>
                                            <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--text-muted)', paddingBottom: '10px' }}>
                                                Blank quantity means available/unavailable is controlled by the sale toggle only.
                                            </div>
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                        <label className="form-label">Images</label>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <input type="url" className="form-input" name="image_url" value={formData.image_url} onChange={handleInputChange} placeholder="https://example.com/image.jpg (Primary Image)" style={{ flex: 1 }} />
                                            <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                                                {uploadingImage ? <Icon name="loader" size={16} /> : <Icon name="upload" size={16} />}
                                                {uploadingImage ? 'Uploading...' : 'Upload'}
                                                <input type="file" multiple accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} disabled={uploadingImage} />
                                            </label>
                                        </div>
                                        {formData.images && formData.images.length > 0 && (
                                            <div style={{ marginTop: '15px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                {formData.images.map((img, index) => (
                                                    <div key={index} style={{ position: 'relative', width: '100px', height: '100px' }}>
                                                        <img src={img} alt={`Preview ${index}`} style={{ width: '100%', height: '100%', borderRadius: '8px', objectFit: 'cover', border: index === 0 ? '2px solid #6366f1' : '1px solid #e2e8f0' }} />
                                                        {index === 0 && <span style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '10px' }}>Primary</span>}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeImage(index)}
                                                            style={{ position: 'absolute', top: '-5px', right: '-5px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '12px' }}>
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                            <button className="btn btn-primary" type="submit" form="productForm" disabled={submitting}>
                                {submitting ? 'Saving...' : 'Save Product'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
