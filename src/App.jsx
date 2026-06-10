import { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Plus, X, Search, Edit2, FolderOpen, FolderPlus, Sun, Moon, ArrowLeft, Compass, Download, Upload } from 'lucide-react';
import { EXPLORE_GPTS } from './data/explore-gpts';
import './App.css';

const DEFAULT_GPTS = [
  {
    id: '1',
    type: 'gpt',
    title: 'Code Wizard',
    description: 'Expert in React and Node.js development.',
    url: 'https://chat.openai.com/g/g-example1',
    iconUrl: '/placeholder.png',
    category: 'Development',
    clickCount: 0
  },
  {
    id: '2',
    type: 'gpt',
    title: 'Writing Assistant',
    description: 'Helps craft emails and blog posts.',
    url: 'https://chat.openai.com/g/g-example2',
    iconUrl: '/placeholder.png',
    category: 'Productivity',
    clickCount: 0
  },
  {
    id: '3',
    type: 'gpt',
    title: 'Data Analyst',
    description: 'Visualizes and interprets complex datasets.',
    url: 'https://chat.openai.com/g/g-example3',
    iconUrl: '/placeholder.png',
    category: 'Data',
    clickCount: 0
  }
];

function App() {
  const [gpts, setGpts] = useState(() => {
    const savedV3 = localStorage.getItem('gpt-dashboard-data-v3');
    if (savedV3) {
      try {
        return JSON.parse(savedV3);
      } catch (e) {
        console.error("Failed to parse saved V3 GPTs", e);
      }
    }
    
    const savedV1 = localStorage.getItem('gpt-dashboard-data');
    if (savedV1) {
      try {
        const parsedV1 = JSON.parse(savedV1);
        // Migrate V1 data to V2 schema
        const migrated = parsedV1.map(gpt => ({
          ...gpt,
          type: 'gpt',
          clickCount: 0
        }));
        return migrated;
      } catch (e) {
        console.error("Failed to parse saved V1 GPTs", e);
      }
    }

    return DEFAULT_GPTS;
  });

  const [theme, setTheme] = useState(() => localStorage.getItem('gpt-dashboard-theme') || 'vercel');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExploreOpen, setIsExploreOpen] = useState(false);
  const [editingGptId, setEditingGptId] = useState(null);
  
  const [newGpt, setNewGpt] = useState({ 
    type: 'gpt', title: '', description: '', url: '', iconUrl: '', category: 'General', parentId: 'root'
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeFolderId, setActiveFolderId] = useState(null);
  
  const searchInputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem('gpt-dashboard-data-v3', JSON.stringify(gpts));
    } catch (e) {
      console.error("Failed to save to localStorage", e);
      if (e.name === 'QuotaExceededError') {
        alert("Storage quota exceeded! An image you uploaded might be too large.");
      }
    }
  }, [gpts]);

  useEffect(() => {
    localStorage.setItem('gpt-dashboard-theme', theme);
    document.body.className = theme === 'vercel' ? '' : `theme-${theme}`;
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setIsModalOpen(false);
        setIsExploreOpen(false);
        setEditingGptId(null);
        if (activeFolderId && !isModalOpen) setActiveFolderId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFolderId, isModalOpen]);

  // Recursively extract all GPTs for analytics and search
  const getAllGpts = (items) => {
    let all = [];
    items.forEach(item => {
      if (item.type === 'gpt') all.push(item);
      else if (item.type === 'folder' && item.items) {
        all = [...all, ...getAllGpts(item.items)];
      }
    });
    return all;
  };

  const allGpts = getAllGpts(gpts);
  const folders = gpts.filter(g => g.type === 'folder');
  
  const mostUsed = [...allGpts]
    .filter(g => g.clickCount > 0)
    .sort((a, b) => b.clickCount - a.clickCount)
    .slice(0, 4);

  const categories = ['All', ...new Set(allGpts.map(g => g.category || 'General'))];
  
  const isFiltered = searchQuery !== '' || selectedCategory !== 'All';

  // Determine what to render based on state
  let displayedItems = [];
  
  if (isFiltered) {
    displayedItems = allGpts.filter(gpt => {
      const matchesSearch = (gpt.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (gpt.description || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || (gpt.category || 'General') === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  } else if (activeFolderId) {
    const folder = gpts.find(g => g.id === activeFolderId);
    displayedItems = folder ? folder.items : [];
  } else {
    displayedItems = gpts;
  }

  const handleCardClick = (item) => {
    if (item.type === 'folder') {
      setActiveFolderId(item.id);
    } else {
      // Increment click count
      const updateClickCount = (itemsList) => {
        return itemsList.map(i => {
          if (i.id === item.id) return { ...i, clickCount: (i.clickCount || 0) + 1 };
          if (i.type === 'folder' && i.items) return { ...i, items: updateClickCount(i.items) };
          return i;
        });
      };
      setGpts(updateClickCount(gpts));
      window.open(item.url, '_blank');
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination || isFiltered) return;

    let itemsToUpdate = activeFolderId 
      ? Array.from(gpts.find(g => g.id === activeFolderId).items) 
      : Array.from(gpts);

    const [reorderedItem] = itemsToUpdate.splice(result.source.index, 1);
    itemsToUpdate.splice(result.destination.index, 0, reorderedItem);

    if (activeFolderId) {
      setGpts(gpts.map(g => g.id === activeFolderId ? { ...g, items: itemsToUpdate } : g));
    } else {
      setGpts(itemsToUpdate);
    }
  };

  const handleOpenModal = (item = null, type = 'gpt') => {
    if (item) {
      setEditingGptId(item.id);
      
      let parentId = 'root';
      if (!activeFolderId) {
        // Find if this item belongs to a folder
        gpts.forEach(f => {
          if (f.type === 'folder' && f.items.some(i => i.id === item.id)) {
            parentId = f.id;
          }
        });
      } else {
        parentId = activeFolderId;
      }

      setNewGpt({ ...item, parentId });
    } else {
      setEditingGptId(null);
      if (type === 'folder') {
        setNewGpt({ type: 'folder', title: '', items: [] });
      } else {
        setNewGpt({ 
          type: 'gpt', title: '', description: '', url: '', iconUrl: '', category: 'General', clickCount: 0,
          parentId: activeFolderId || 'root'
        });
      }
    }
    setIsModalOpen(true);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newGpt.title) return;
    if (newGpt.type === 'gpt' && !newGpt.url) return;

    const targetFolderId = newGpt.parentId === 'root' ? null : newGpt.parentId;
    const itemToSave = { ...newGpt };
    delete itemToSave.parentId; // Clean up

    if (editingGptId) {
      // Deletion from anywhere it exists, then re-insertion into correct location
      const removeItem = (list) => list.filter(i => i.id !== editingGptId).map(i => {
        if (i.type === 'folder' && i.items) return { ...i, items: removeItem(i.items) };
        return i;
      });
      
      let newGptsList = removeItem(gpts);
      
      if (targetFolderId) {
        newGptsList = newGptsList.map(f => f.id === targetFolderId ? { ...f, items: [...f.items, itemToSave] } : f);
      } else {
        newGptsList = [itemToSave, ...newGptsList];
      }
      setGpts(newGptsList);
    } else {
      itemToSave.id = Date.now().toString();
      if (targetFolderId) {
        setGpts(gpts.map(f => f.id === targetFolderId ? { ...f, items: [itemToSave, ...f.items] } : f));
      } else {
        setGpts([itemToSave, ...gpts]);
      }
    }
    
    setIsModalOpen(false);
    setEditingGptId(null);
  };

  const handleDelete = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    
    const removeItem = (list) => list.filter(i => i.id !== id).map(i => {
      if (i.type === 'folder' && i.items) return { ...i, items: removeItem(i.items) };
      return i;
    });
    
    setGpts(removeItem(gpts));
  };

  const handleAddFromExplore = (item) => {
    const newItem = { ...item, id: Date.now().toString(), clickCount: 0 };
    setGpts([newItem, ...gpts]);
    setIsExploreOpen(false);
  };

  const handleExport = () => {
    const data = {
      gpts,
      theme
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gpt-dashboard-backup.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.gpts) setGpts(data.gpts);
        if (data.theme) setTheme(data.theme);
        // Force reload to ensure everything syncs visually
        setTimeout(() => window.location.reload(), 100);
      } catch (err) {
        alert('Invalid backup file');
      }
    };
    reader.readAsText(file);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxSize = 128; 
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxSize) {
              height *= maxSize / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width *= maxSize / height;
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setNewGpt({ ...newGpt, iconUrl: compressedDataUrl });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const renderCard = (item, index, isDragDisabled = false) => (
    <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`gpt-card-wrapper ${snapshot.isDragging ? 'is-dragging' : ''}`}
          style={{
            ...provided.draggableProps.style,
            animationDelay: `${index * 0.05}s`
          }}
        >
          <div className="gpt-card vercel-panel" onClick={() => handleCardClick(item)}>
            <div className="card-actions">
              <button 
                className="icon-btn"
                onClick={(e) => { e.stopPropagation(); handleOpenModal(item, item.type); }}
                title="Edit"
              >
                <Edit2 size={14} />
              </button>
              <button 
                className="icon-btn delete-hover"
                onClick={(e) => handleDelete(e, item.id)}
                title="Remove"
              >
                <X size={14} />
              </button>
            </div>
            
            <div className="gpt-card-inner">
              <div className="icon-container">
                {item.type === 'folder' ? (
                  <div className="folder-icon"><FolderOpen size={40} /></div>
                ) : (
                  <img src={item.iconUrl || '/placeholder.png'} alt={item.title} onError={(e) => {
                      e.target.onerror = null; 
                      e.target.src = '/placeholder.png';
                  }}/>
                )}
              </div>
              
              <div className="gpt-info">
                {item.type === 'gpt' && <span className="gpt-category-tag">{item.category || 'General'}</span>}
                <h3 className="gpt-title">{item.title}</h3>
                {item.type === 'gpt' ? (
                  <p className="gpt-desc">{item.description}</p>
                ) : (
                  <p className="gpt-desc">{item.items?.length || 0} items</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );

  return (
    <div className="app-container">
      
      {/* HEADER */}
      <header className="header">
        <h1>GPT Dash</h1>
        <div className="header-actions">
          <button className="icon-btn-header" onClick={() => setTheme(theme === 'vercel' ? 'light' : 'vercel')}>
            {theme === 'vercel' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          
          {/* Hidden file input for import */}
          <input 
            type="file" 
            id="import-upload" 
            style={{ display: 'none' }} 
            accept=".json"
            onChange={handleImport}
          />
          <button className="icon-btn-header" title="Import Data" onClick={() => document.getElementById('import-upload').click()}>
            <Upload size={20} />
          </button>
          <button className="icon-btn-header" title="Export Data" onClick={handleExport}>
            <Download size={20} />
          </button>
          
          <button className="icon-btn-header" onClick={() => handleOpenModal(null, 'folder')}>
            <FolderPlus size={20} />
          </button>
          <button className="add-btn" onClick={() => setIsExploreOpen(true)} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none' }}>
            <Compass size={20} />
            <span>Explore</span>
          </button>
          <button className="add-btn" onClick={() => handleOpenModal(null, 'gpt')}>
            <Plus size={20} />
            <span>Add GPT</span>
          </button>
        </div>
      </header>

      {/* TOP BAR / FILTERS */}
      <div className="top-bar">
        <div className="top-bar-controls">
          <div className="search-wrapper">
            <Search className="search-icon" size={18} />
            <input 
              ref={searchInputRef}
              type="text" 
              className="search-input" 
              placeholder="Search your GPTs..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <div className="shortcut-hint">⌘K</div>
          </div>
        </div>
        
        <div className="categories">
          {categories.map(cat => (
            <button 
              key={cat} 
              className={`category-pill ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* MOST USED ROW (Only on root view when not searching) */}
      {!isFiltered && !activeFolderId && mostUsed.length > 0 && (
        <div className="most-used-section">
          <h2 className="section-title">Frequently Used</h2>
          <div className="most-used-grid">
            {mostUsed.map((gpt, index) => (
              <div key={`mu-${gpt.id}`} className="most-used-item">
                {renderCard(gpt, index, true)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      {displayedItems.length === 0 ? (
        <div className="empty-state">
          <FolderOpen className="empty-state-icon" />
          <h3>Nothing here</h3>
          <p>You don't have any items matching your criteria. Add a new GPT to get started!</p>
          <button className="add-btn" onClick={() => handleOpenModal(null, 'gpt')} style={{marginTop: '1rem'}}>
            <Plus size={18} />
            <span>Add GPT</span>
          </button>
        </div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="gpt-grid" direction="horizontal" isDropDisabled={isFiltered}>
            {(provided) => (
              <div 
                className="grid-container" 
                {...provided.droppableProps} 
                ref={provided.innerRef}
              >
                {displayedItems.map((item, index) => renderCard(item, index, isFiltered))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* FOLDER OVERLAY VIEW */}
      {activeFolderId && !isFiltered && (
        <div className="folder-view-overlay">
          <div className="folder-header">
            <button className="icon-btn-header" onClick={() => setActiveFolderId(null)}>
              <ArrowLeft size={20} />
            </button>
            <h1>{gpts.find(g => g.id === activeFolderId)?.title}</h1>
            <button className="add-btn" onClick={() => handleOpenModal(null, 'gpt')}>
              <Plus size={20} />
              <span>Add to Folder</span>
            </button>
          </div>
          
          <div className="folder-grid-container">
            {displayedItems.length === 0 ? (
              <div className="empty-state">
                <FolderOpen className="empty-state-icon" />
                <h3>Empty Folder</h3>
                <p>This folder is empty. Add some GPTs to it!</p>
              </div>
            ) : (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="folder-grid" direction="horizontal">
                  {(provided) => (
                    <div 
                      className="grid-container" 
                      {...provided.droppableProps} 
                      ref={provided.innerRef}
                    >
                      {displayedItems.map((item, index) => renderCard(item, index, false))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>
        </div>
      )}

      {/* EXPLORE OVERLAY VIEW */}
      {isExploreOpen && (
        <div className="folder-view-overlay" style={{ zIndex: 1500 }}>
          <div className="folder-header">
            <button className="icon-btn-header" onClick={() => setIsExploreOpen(false)}>
              <ArrowLeft size={20} />
            </button>
            <h1>Explore GPTs</h1>
          </div>
          
          <div className="folder-grid-container">
            <div className="grid-container">
              {EXPLORE_GPTS.map((item, index) => (
                <div key={item.id} className="gpt-card-wrapper">
                  <div className="gpt-card vercel-panel" style={{ cursor: 'default' }}>
                    <div className="gpt-card-inner">
                      <div className="icon-container">
                        <img src={item.iconUrl || '/placeholder.png'} alt={item.title} />
                      </div>
                      
                      <div className="gpt-info">
                        <span className="gpt-category-tag">{item.category}</span>
                        <h3 className="gpt-title">{item.title}</h3>
                        <p className="gpt-desc" style={{ marginBottom: '1rem' }}>{item.description}</p>
                        
                        <button 
                          className="add-btn" 
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={() => handleAddFromExplore(item)}
                        >
                          <Plus size={16} />
                          <span>Add</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)} style={{zIndex: 2000}}>
          <div className="modal-content vercel-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingGptId ? `Edit ${newGpt.type === 'folder' ? 'Folder' : 'GPT'}` : `Add New ${newGpt.type === 'folder' ? 'Folder' : 'GPT'}`}</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleAddSubmit}>
              <div className="form-group">
                <label>Title *</label>
                <input 
                  type="text" 
                  required 
                  value={newGpt.title}
                  onChange={e => setNewGpt({...newGpt, title: e.target.value})}
                  placeholder={newGpt.type === 'folder' ? "e.g. Work Tools" : "e.g. Code Wizard"}
                />
              </div>

              {newGpt.type === 'gpt' && (
                <>
                  <div className="form-group">
                    <label>URL *</label>
                    <input 
                      type="url" 
                      required 
                      value={newGpt.url}
                      onChange={e => setNewGpt({...newGpt, url: e.target.value})}
                      placeholder="https://chatgpt.com/g/..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Folder Location</label>
                    <select 
                      className="category-select"
                      value={newGpt.parentId}
                      onChange={e => setNewGpt({...newGpt, parentId: e.target.value})}
                    >
                      <option value="root">Home (Root)</option>
                      {folders.filter(f => f.id !== editingGptId).map(f => (
                        <option key={f.id} value={f.id}>{f.title}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Category</label>
                    <select 
                      className="category-select"
                      value={newGpt.category || 'General'}
                      onChange={e => setNewGpt({...newGpt, category: e.target.value})}
                    >
                      <option value="General">General</option>
                      <option value="Development">Development</option>
                      <option value="Productivity">Productivity</option>
                      <option value="Writing">Writing</option>
                      <option value="Data">Data</option>
                      <option value="Design">Design</option>
                      <option value="Education">Education</option>
                      <option value="Fun">Fun</option>
                    </select>
                  </div>
                  
                  <div className="form-group">
                    <label>Description</label>
                    <textarea 
                      value={newGpt.description}
                      onChange={e => setNewGpt({...newGpt, description: e.target.value})}
                      placeholder="Brief description..."
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Icon URL (Optional)</label>
                    <input 
                      type="url" 
                      value={newGpt.iconUrl && !newGpt.iconUrl.startsWith('data:') ? newGpt.iconUrl : ''}
                      onChange={e => setNewGpt({...newGpt, iconUrl: e.target.value})}
                      placeholder="Paste image URL..."
                    />
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.75rem' }}>
                      <label style={{ fontSize: '0.8rem', cursor: 'pointer', background: 'var(--bg-tertiary)', padding: '0.6rem 1rem', borderRadius: '6px' }}>
                        <span>Or upload from device</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleImageUpload}
                          style={{ display: 'none' }}
                        />
                      </label>
                      
                      {newGpt.iconUrl && (
                        <img src={newGpt.iconUrl} alt="Preview" style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
                      )}
                    </div>
                  </div>
                </>
              )}
              
              <button type="submit" className="submit-btn">{editingGptId ? 'Save Changes' : 'Create'}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
