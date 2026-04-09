import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Settings, Puzzle, Activity, CreditCard, 
  Receipt, Users, HelpCircle, Mail, Chrome, Bell, Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';

export default function SettingsDashboard() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [activeLlama, setActiveLlama] = useState('western');

  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
  }, [user]);

  const sidebarItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'integrations', label: 'Integrations', icon: Puzzle },
    { divider: true, id: 'd1' },
    { id: 'usage', label: 'Usage', icon: Activity },
    { id: 'spending', label: 'Spending', icon: CreditCard },
    { id: 'billing', label: 'Billing & Invoices', icon: Receipt },
    { divider: true, id: 'd2' },
    { id: 'referrals', label: 'Referrals', icon: Users },
    { id: 'help', label: 'Help', icon: HelpCircle },
    { id: 'contact', label: 'Contact Us', icon: Mail },
  ];

  const plans = [
    {
      id: 'creator',
      name: 'Creator',
      price: '$20/mo.',
      description: 'Entry-level plan with access to premium models and more.',
      buttonText: 'Upgrade to Creator'
    },
    {
      id: 'creator-plus',
      name: 'Creator+',
      price: '$60/mo.',
      description: 'Includes 3x more usage on OpenAI and Gemini models.',
      buttonText: 'Upgrade to Creator+'
    },
    {
      id: 'ultra',
      name: 'Ultra',
      price: '$200/mo.',
      description: 'Get maximum value with 20x usage limits and early access to advanced features.',
      buttonText: 'Upgrade to Ultra'
    }
  ];

  const llamas = [
    { id: 'western', name: 'Western' },
    { id: 'classic', name: 'Classic' },
    { id: 'afterparty', name: 'Afterparty' },
    { id: 'bananas', name: 'Bananas' },
    { id: 'vr', name: 'VR Mode' },
    { id: 'launch', name: 'Launch' },
  ];

  const handleSaveProfile = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      // Update Supabase Auth User Metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: displayName }
      });

      if (authError) throw authError;

      // Update Supabase Profile table
      const { error: dbError } = await supabase
        .from('profiles')
        .upsert({
          id: user.uid,
          display_name: displayName,
          email: user.email,
          photo_url: user.photoURL,
          updated_at: new Date().toISOString()
        });

      if (dbError) throw dbError;

      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpgrade = (planId: string) => {
    // In a real app, this would redirect to a Stripe Checkout session
    alert(`Redirecting to Stripe checkout for ${planId} plan... (Integration ready)`);
  };

  const handleConnectYouTube = () => {
    // In a real app, this would initiate Google OAuth with YouTube scopes
    alert('Initiating YouTube OAuth flow... (Integration ready)');
  };

  return (
    <div className="flex flex-col md:flex-row h-full" dir="ltr">
      {/* Settings Sidebar */}
      <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-background p-4 md:p-6 overflow-x-auto md:overflow-y-auto flex-shrink-0">
        <div className="mb-4 md:mb-8 hidden md:block">
          <button className="text-xs font-bold text-muted-foreground hover:text-foreground flex items-center gap-2 mb-6 transition-colors">
            ‹ BACK TO STUDIO
          </button>
          <p className="text-sm text-muted-foreground truncate">
            Hobby • {user?.email || 'user@example.com'}
          </p>
        </div>

        <nav className="flex md:flex-col gap-2 md:gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          {sidebarItems.map((item) => {
            if (item.divider) {
              return <div key={item.id} className="hidden md:block h-px bg-border my-4"></div>;
            }
            const Icon = item.icon!;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-shrink-0 md:w-full flex items-center gap-2 md:gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Settings Content */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto max-w-5xl">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            <h1 className="text-3xl font-bold text-foreground mb-6">Plans</h1>
            
            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map((plan) => (
                <div key={plan.name} className="bg-card border border-border rounded-xl p-6 flex flex-col">
                  <h3 className="font-bold text-lg text-foreground mb-1">
                    {plan.name} <span className="text-muted-foreground text-sm font-normal">{plan.price}</span>
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6 flex-1">
                    {plan.description}
                  </p>
                  <button 
                    onClick={() => handleUpgrade(plan.id)}
                    className="w-full py-2 bg-transparent border border-blue-500 text-blue-500 rounded-lg font-medium hover:bg-blue-500/10 transition-colors"
                  >
                    {plan.buttonText}
                  </button>
                </div>
              ))}
            </div>

            {/* Llama Fit */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="font-bold text-lg text-foreground mb-1">Pick Your Llama Fit</h3>
                  <p className="text-sm text-muted-foreground">Rotating fits keep things fresh in loaders, celebrations, and shoutouts.</p>
                </div>
                <div className="px-3 py-1 bg-muted rounded-full text-xs font-bold text-muted-foreground flex items-center gap-2">
                  <span className="w-4 h-4 bg-white rounded-sm inline-block"></span> CURRENT
                </div>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {llamas.map((llama) => (
                  <button 
                    key={llama.id}
                    onClick={() => setActiveLlama(llama.id)}
                    className={`flex-shrink-0 w-24 h-24 rounded-xl flex flex-col items-center justify-center gap-2 transition-all ${
                      activeLlama === llama.id 
                        ? 'bg-muted border-2 border-border' 
                        : 'bg-muted/30 border border-transparent hover:bg-muted/50'
                    }`}
                  >
                    <div className="w-8 h-8 bg-white rounded-sm"></div>
                    <span className="text-xs font-medium text-foreground">
                      {llama.name} {activeLlama === llama.id && '•'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Chrome Extension */}
            <div 
              onClick={() => alert('Chrome extension coming soon to the Web Store!')}
              className="bg-card border border-border rounded-xl p-6 flex items-center justify-between group cursor-pointer hover:border-accent transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Chrome className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1 flex items-center gap-2">
                    Get the Chrome Extension
                    <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-500 text-[10px] uppercase rounded font-bold">New</span>
                  </h3>
                  <p className="text-sm text-muted-foreground">Edit thumbnails directly from YouTube Studio and see click multipliers on every video.</p>
                </div>
              </div>
              <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                ↗
              </div>
            </div>

            {/* Newsletter */}
            <div className="bg-card border border-border rounded-xl p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground mb-1">Never miss a thumbnail drop ;)</h3>
                  <p className="text-sm text-muted-foreground">Be first to get new thumbnail templates and major feature launches.</p>
                </div>
              </div>
              <div 
                className="w-12 h-6 bg-accent rounded-full relative cursor-pointer transition-colors"
                onClick={() => alert('Newsletter preferences updated!')}
              >
                <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-8">
            <h1 className="text-3xl font-bold text-foreground mb-6">Settings</h1>
            <div className="bg-card border border-border rounded-xl p-6 space-y-4 max-w-xl">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Email Address</label>
                <input type="email" value={user?.email || ''} disabled className="w-full bg-muted/50 border border-border rounded-lg p-2 text-foreground opacity-70 cursor-not-allowed" />
                <p className="text-xs text-muted-foreground mt-1">Email is managed by your authentication provider.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Display Name</label>
                <input 
                  type="text" 
                  value={displayName} 
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-foreground focus:border-accent outline-none transition-colors" 
                />
              </div>
              <button 
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="px-6 py-2 bg-foreground text-background rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save Changes
              </button>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="space-y-8">
            <h1 className="text-3xl font-bold text-foreground mb-6">Integrations</h1>
            <div className="bg-card border border-border rounded-xl p-6 flex items-center justify-between max-w-2xl">
              <div>
                <h3 className="font-bold text-foreground">YouTube Channel</h3>
                <p className="text-sm text-muted-foreground">Connect your channel to sync videos and thumbnails directly to your studio.</p>
              </div>
              <button 
                onClick={handleConnectYouTube}
                className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg font-medium transition-colors whitespace-nowrap"
              >
                Connect YouTube
              </button>
            </div>
          </div>
        )}

        {['usage', 'spending', 'billing', 'referrals', 'help', 'contact'].includes(activeTab) && (
          <div className="space-y-8">
            <h1 className="text-3xl font-bold text-foreground mb-6 capitalize">{activeTab.replace('-', ' ')}</h1>
            <div className="bg-card border border-border rounded-xl p-8 text-center max-w-2xl">
              <p className="text-muted-foreground mb-4">No data available for this section yet.</p>
              <button 
                onClick={() => alert('Refreshing data...')}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium transition-colors"
              >
                Refresh Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
