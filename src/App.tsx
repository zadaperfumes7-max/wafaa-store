import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from './lib/firebase';
import { 
  ShoppingBag, 
  Plus, 
  Trash2, 
  Edit, 
  LogOut, 
  LogIn, 
  Shield, 
  X, 
  Image as ImageIcon,
  MessageCircle,
  Search,
  Menu,
  ChevronRight,
  Star,
  AlertTriangle,
  Upload,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast, { Toaster } from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public props: ErrorBoundaryProps;
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let message = "Something went wrong.";
      message = this.state.error.message || message;

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="glass-dark p-8 rounded-3xl max-w-md text-center border border-red-500/20">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-serif font-bold mb-4">System Alert</h2>
            <p className="text-white/60 mb-6">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="btn-royal w-full"
            >
              Restart Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const WHATSAPP_NUMBER = "+201156869853";
const ADMIN_EMAIL = "zada.perfumes7@gmail.com";

// --- Types ---
interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  category: string;
  createdAt: any;
}

// --- Components ---

interface GlassCardProps {
  children?: React.ReactNode;
  className?: string;
  delay?: number;
  [key: string]: any;
}

const GlassCard = ({ children, className, delay = 0, ...props }: GlassCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay }}
    className={cn("glass rounded-2xl overflow-hidden", className)}
    {...props}
  >
    {children}
  </motion.div>
);

const Navbar = ({ user, onLogin, onLogout, isAdmin, onToggleAdmin }: { 
  user: FirebaseUser | null, 
  onLogin: () => void, 
  onLogout: () => void,
  isAdmin: boolean,
  onToggleAdmin: () => void
}) => (
  <nav className="fixed top-0 left-0 right-0 z-50 px-4 py-6">
    <div className="max-w-7xl mx-auto glass rounded-full px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 glass-royal rounded-full flex items-center justify-center">
          <ShoppingBag className="text-white w-5 h-5" />
        </div>
        <span className="text-xl font-display font-bold tracking-[0.2em] text-white">WAFAA <span className="royal-text-gradient">STORE</span></span>
      </div>
      
      <div className="flex items-center gap-6">
        {user ? (
          <div className="flex items-center gap-6">
            {isAdmin && (
              <button 
                onClick={onToggleAdmin}
                className="flex items-center gap-2 text-xs uppercase tracking-widest font-display font-semibold hover:text-white transition-all"
              >
                <Shield className="w-4 h-4" />
                Management
              </button>
            )}
            <div className="flex items-center gap-4 border-l border-white/10 pl-6">
              <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-white/30" referrerPolicy="no-referrer" />
              <button onClick={onLogout} className="text-white/40 hover:text-white transition-colors">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button onClick={onLogin} className="text-xs uppercase tracking-widest font-display font-semibold text-white/60 hover:text-white transition-all">
            Login
          </button>
        )}
      </div>
    </div>
  </nav>
);

const ProductModal = ({ isOpen, onClose, onSave, product }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (data: Partial<Product>) => void,
  product?: Product | null
}) => {
  const [formData, setFormData] = useState<Partial<Product>>(
    product || { name: '', description: '', price: 0, imageUrl: '', category: '' }
  );
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    if (product) setFormData(product);
    else setFormData({ name: '', description: '', price: 0, imageUrl: '', category: '' });
  }, [product]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation: Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image is too large (Max 5MB)');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Create canvas for compression
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max dimensions (e.g., 800px)
          const MAX_SIZE = 800;
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with 0.7 quality
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          
          setFormData(prev => ({ ...prev, imageUrl: compressedBase64 }));
          setUploadProgress(100);
          toast.success('Image processed and compressed');
          setTimeout(() => {
            setIsUploading(false);
            setUploadProgress(0);
          }, 500);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Processing error:', error);
      toast.error(`Processing failed: ${error.message}`);
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/80 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="glass-dark w-full max-w-xl p-10 rounded-[2rem] relative border border-white/20"
      >
        <button onClick={onClose} className="absolute top-8 right-8 text-white/20 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-3xl font-serif font-bold mb-8 royal-text-gradient">{product ? 'Refine Product' : 'New Masterpiece'}</h2>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] font-display font-bold text-white/40 mb-2">Fragrance Name</label>
              <input 
                type="text" 
                className="input-glass w-full" 
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Midnight Oud"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] font-display font-bold text-white/40 mb-2">Category</label>
              <input 
                type="text" 
                className="input-glass w-full" 
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g. Oriental"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] font-display font-bold text-white/40 mb-2">Price (EGP)</label>
              <input 
                type="number" 
                className="input-glass w-full" 
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-[0.2em] font-display font-bold text-white/40 mb-2">Product Image</label>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <label className={cn(
                    "flex-1 flex items-center justify-center gap-2 input-glass cursor-pointer hover:bg-white/5 transition-all relative overflow-hidden",
                    isUploading && "opacity-50 cursor-wait"
                  )}>
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-xs font-mono">{uploadProgress}%</span>
                        <div 
                          className="absolute bottom-0 left-0 h-1 bg-white/20 transition-all duration-300" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </>
                    ) : (
                      <>
                        {formData.imageUrl?.startsWith('http') && !formData.imageUrl.includes('firebasestorage') ? 
                          <ImageIcon className="w-4 h-4 text-blue-400" /> : 
                          formData.imageUrl ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Upload className="w-4 h-4" />
                        }
                        <span className="text-xs truncate">
                          {formData.imageUrl ? 'Change Image' : 'Upload Image'}
                        </span>
                      </>
                    )}
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={isUploading}
                    />
                  </label>
                  {formData.imageUrl && (
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-white/10 shrink-0">
                      <img src={formData.imageUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                    <span className="text-[10px] text-white/20 font-bold uppercase">OR URL</span>
                  </div>
                  <input 
                    type="text" 
                    className="input-glass w-full pl-16 text-xs" 
                    placeholder="Paste image link here..."
                    value={formData.imageUrl}
                    onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-[0.2em] font-display font-bold text-white/40 mb-2">Olfactory Story</label>
            <textarea 
              className="input-glass w-full h-32 resize-none rounded-2xl" 
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the essence..."
            />
          </div>
          
          <button 
            onClick={() => onSave(formData)}
            disabled={isUploading}
            className="btn-royal w-full mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {product ? 'Save Changes' : 'Curate Product'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export function StoreApp() {
  const [products, setProducts] = useState<Product[]>([]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      const isUserAdmin = u?.email === ADMIN_EMAIL;
      setIsAdmin(isUserAdmin);
      if (isUserAdmin) {
        setShowAdminPanel(true);
      }
      setLoading(false);
    });

    const productsPath = 'products';
    const q = query(collection(db, productsPath), orderBy('createdAt', 'desc'));
    const unsubscribeProducts = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, productsPath);
    });

    // Test connection
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    return () => {
      unsubscribeAuth();
      unsubscribeProducts();
    };
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Logged in successfully');
    } catch (error: any) {
      console.error('Login error:', error);
      toast.error(`Login failed: ${error.message || 'Unknown error'}`);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setShowAdminPanel(false);
    toast.success('Logged out');
  };

  const handleSaveProduct = async (data: Partial<Product>) => {
    const productsPath = 'products';
    try {
      if (editingProduct) {
        await updateDoc(doc(db, productsPath, editingProduct.id), data);
        toast.success('Refined successfully');
      } else {
        await addDoc(collection(db, productsPath), {
          ...data,
          createdAt: serverTimestamp()
        });
        toast.success('Masterpiece added');
      }
      setIsModalOpen(false);
      setEditingProduct(null);
    } catch (error) {
      handleFirestoreError(error, editingProduct ? OperationType.UPDATE : OperationType.CREATE, productsPath);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const productsPath = 'products';
    if (!window.confirm('Are you sure you want to remove this masterpiece?')) return;
    try {
      await deleteDoc(doc(db, productsPath, id));
      toast.success('Removed from collection');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, productsPath);
    }
  };

  const orderViaWhatsApp = (product: Product) => {
    const message = `Hello Wafaa Store, I would like to order: ${product.name} (${product.price} EGP)`;
    const url = `https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-white border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      <Toaster position="bottom-right" />
      <Navbar 
        user={user} 
        onLogin={handleLogin} 
        onLogout={handleLogout} 
        isAdmin={isAdmin}
        onToggleAdmin={() => setShowAdminPanel(!showAdminPanel)}
      />

      <AnimatePresence mode="wait">
        {showAdminPanel ? (
          <motion.main 
            key="admin"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="pt-32 px-4 max-w-7xl mx-auto"
          >
            <div className="flex items-center justify-between mb-12">
              <h1 className="text-4xl font-serif font-bold royal-text-gradient">Collection Management</h1>
              <button 
                onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
                className="btn-royal flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Add Masterpiece
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {products.map(product => (
                <GlassCard key={product.id} className="p-6 flex gap-6 items-center border-white/[0.05]">
                  <img src={product.imageUrl} alt="" className="w-24 h-24 rounded-2xl object-cover border border-white/20" referrerPolicy="no-referrer" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-serif font-bold text-xl truncate">{product.name}</h3>
                    <p className="royal-text-gradient font-display font-semibold">{product.price} EGP</p>
                    <p className="text-white/20 text-[10px] uppercase tracking-widest mt-1">{product.category}</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={() => { setEditingProduct(product); setIsModalOpen(true); }}
                      className="p-3 hover:bg-white/5 rounded-xl text-white transition-colors"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleDeleteProduct(product.id)}
                      className="p-3 hover:bg-white/5 rounded-xl text-red-400/60 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </GlassCard>
              ))}
            </div>
          </motion.main>
        ) : (
          <motion.main 
            key="store"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pt-32 px-4 max-w-7xl mx-auto"
          >
            {/* Hero Section */}
            <section className="mb-32 text-center relative">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.5 }}
                className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-[120px] -z-10"
              />
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="inline-block glass px-6 py-2 rounded-full text-[10px] uppercase tracking-[0.4em] font-display font-bold text-white mb-8"
              >
                The Art of Fragrance
              </motion.div>
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.8 }}
                className="text-7xl md:text-9xl font-serif font-bold tracking-tighter mb-8 leading-[0.9]"
              >
                ELEGANCE IN <br />
                <span className="royal-text-gradient italic">EVERY DROP</span>
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="text-white/40 text-lg md:text-xl max-w-2xl mx-auto mb-12 font-light leading-relaxed"
              >
                Step into a world where scent meets soul. Our curated collection 
                defines the pinnacle of olfactory craftsmanship.
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="max-w-xl mx-auto relative group"
              >
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 w-5 h-5 group-focus-within:text-white transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search your signature essence..."
                  className="input-glass w-full pl-14 py-5 text-lg"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </motion.div>
            </section>

            {/* Products Grid */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
              {filteredProducts.map((product, idx) => (
                <GlassCard key={product.id} delay={idx * 0.1} className="group border-white/[0.05] hover:border-white/30 transition-all duration-700">
                  <div className="relative aspect-[3/4] overflow-hidden">
                    <img 
                      src={product.imageUrl} 
                      alt={product.name} 
                      className="w-full h-full object-cover transition-transform duration-[2s] ease-out group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-rich-black via-transparent to-transparent opacity-60" />
                    
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 bg-rich-black/40 backdrop-blur-[2px]">
                      <button 
                        onClick={() => orderViaWhatsApp(product)}
                        className="btn-royal scale-90 group-hover:scale-100 transition-transform duration-500"
                      >
                        Acquire Now
                      </button>
                    </div>
                    
                    <div className="absolute top-6 left-6">
                      <div className="glass-royal px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-display font-bold text-white">
                        {product.category || 'Exclusive'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-8 text-center">
                    <h3 className="text-2xl font-serif font-bold mb-2 group-hover:text-white transition-colors duration-500">{product.name}</h3>
                    <p className="text-white/30 text-xs uppercase tracking-[0.2em] font-display mb-4">{product.category}</p>
                    <div className="w-12 h-[1px] bg-white/30 mx-auto mb-6" />
                    <p className="text-white/40 text-sm font-light mb-8 line-clamp-2 leading-relaxed italic">"{product.description}"</p>
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-3xl font-display font-light royal-text-gradient">{product.price}</span>
                      <span className="text-[10px] uppercase tracking-widest text-white/20 font-bold">EGP</span>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </section>

            {filteredProducts.length === 0 && (
              <div className="text-center py-20">
                <ImageIcon className="w-16 h-16 text-white/10 mx-auto mb-4" />
                <p className="text-white/40 text-xl">No perfumes found matching your search.</p>
              </div>
            )}
          </motion.main>
        )}
      </AnimatePresence>

      <ProductModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingProduct(null); }}
        onSave={handleSaveProduct}
        product={editingProduct}
      />

      <footer className="mt-20 py-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <ShoppingBag className="text-white w-6 h-6" />
            <span className="text-xl font-bold tracking-tighter">WAFAA <span className="text-white">STORE</span></span>
          </div>
          <p className="text-white/40 text-sm">© 2026 Wafaa Store. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="text-white/40 hover:text-white transition-colors">Instagram</a>
            <a href="#" className="text-white/40 hover:text-white transition-colors">Facebook</a>
            <a href={`https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}`} className="text-white/40 hover:text-white transition-colors">WhatsApp</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreApp />
    </ErrorBoundary>
  );
}
