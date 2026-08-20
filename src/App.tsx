import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { Sidebar, ActiveTab } from './components/Sidebar';
import { DashboardConsultant } from './components/DashboardConsultant';
import { GestionCV } from './components/GestionCV';
import { GenerationCV } from './components/GenerationCV';
import { RecommandationFormations } from './components/RecommandationFormations';
import { MatchingMissions } from './components/MatchingMissions';
import { DashboardManager } from './components/DashboardManager';
import { DashboardRH } from './components/DashboardRH';
import { GestionUsersAdmin } from './components/GestionUsersAdmin';
import { Login } from './components/Login';
import { RoleManagementModal } from './components/RoleManagementModal';
import { AccessRestricted } from './components/AccessRestricted';

import { INITIAL_CONSULTANTS, INITIAL_MISSIONS, INITIAL_FORMATIONS } from './mockData';
import { Consultant, Mission, Formation, UserSession, UserRole } from './types';

export default function App() {
  const [users, setUsers] = useState<UserSession[]>([]);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [currentRole, setCurrentRole] = useState<UserRole>('Consultant');
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard-consultant');

  const tabForRole = (role: UserRole): ActiveTab => {
    switch (role) {
      case 'Admin': return 'admin-console';
      case 'Manager': return 'dashboard-manager';
      case 'RH': return 'dashboard-rh';
      case 'Consultant':
      default: return 'dashboard-consultant';
    }
  };

  const applyAuthenticatedUser = (user: UserSession) => {
    const role = user.role;
    setCurrentUser(user);
    setCurrentRole(role);
    setActiveTab(tabForRole(role));
    if (user.consultantId) {
      const found = consultants.find(c => c.id === user.consultantId);
      if (found) setSelectedConsultant(found);
    }
  };

  const isDarkMode = false;
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState<boolean>(false);

  const [consultants, setConsultants] = useState<Consultant[]>(INITIAL_CONSULTANTS);
  const [selectedConsultant, setSelectedConsultant] = useState<Consultant>(INITIAL_CONSULTANTS[0]);
  const [missions, setMissions] = useState<Mission[]>(INITIAL_MISSIONS);
  const [formations, setFormations] = useState<Formation[]>(INITIAL_FORMATIONS);

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(async response => response.ok ? response.json() : null)
      .then(data => {
        if (data?.user) {
          applyAuthenticatedUser(data.user as UserSession);
        }
      })
      .finally(() => setAuthLoading(false));
  }, []);

  const reloadUsers = async () => {
    const response = await fetch('/api/db/users', { credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || 'Impossible de charger les utilisateurs');
    setUsers(Array.isArray(data.users) ? data.users : []);
    return data.users as UserSession[];
  };

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'Admin') return;
    reloadUsers().catch(error => console.error('Chargement utilisateurs:', error));
  }, [currentUser]);

  const handleLogin = (user: UserSession) => {
    applyAuthenticatedUser(user);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setCurrentUser(null);
    setCurrentRole('Consultant');
  };

  const handleAddUser = async (newUser: UserSession) => {
    const password = (newUser as UserSession & { password?: string }).password;
    const response = await fetch('/api/db/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        nom: newUser.nom.trim(),
        prenom: newUser.prenom.trim(),
        email: newUser.email.trim(),
        password,
        role: newUser.role,
        title: newUser.title?.trim() || null,
        department: newUser.department?.trim() || null,
        status: newUser.status || 'Actif',
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || data.details || 'Impossible de créer l’utilisateur');
    await reloadUsers();
    return data.user;
  };

  const handleUpdateUser = async (updatedUser: UserSession & { password?: string }) => {
    const payload: Record<string, unknown> = {
      nom: updatedUser.nom.trim(),
      prenom: updatedUser.prenom.trim(),
      email: updatedUser.email.trim(),
      role: updatedUser.role,
      title: updatedUser.title?.trim() || null,
      department: updatedUser.department?.trim() || null,
      status: updatedUser.status || 'Actif',
    };
    if (updatedUser.password?.trim()) payload.password = updatedUser.password;
    const response = await fetch(`/api/db/users/${updatedUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || data.details || 'Impossible de mettre à jour l’utilisateur');
    const saved = data.user as UserSession;
    await reloadUsers();
    if (currentUser?.id === updatedUser.id && saved) { setCurrentUser(saved); setCurrentRole(saved.role); }
    return saved;
  };


  const handleDeleteUser = async (userId: string) => {
    const response = await fetch(`/api/db/users/${userId}`, { method: 'DELETE', credentials: 'include' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || data.details || 'Impossible de supprimer l’utilisateur');
    await reloadUsers();
  };

  const handleUpdateConsultantCV = (score: number, _updatedKeywords: string[]) => {
    const updated = { ...selectedConsultant, cvScore: score };
    setSelectedConsultant(updated);
    setConsultants(prev => prev.map(c => c.id === updated.id ? updated : c));
  };

  const handleStartCourse = (courseId: string) => {
    setFormations(prev => prev.map(f => {
      if (f.id === courseId) {
        return { ...f, status: 'En_cours', progressPercentage: f.progressPercentage || 10 };
      }
      return f;
    }));
  };

  const handleAddMission = (newMission: Mission) => {
    setMissions(prev => [newMission, ...prev]);
  };

  const handleAddFormation = (newFormation: Formation) => {
    setFormations(prev => [newFormation, ...prev]);
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800">Chargement sécurisé…</div>;
  }

  // If user is not logged in, render Login component
  if (!currentUser) {
    return <Login onLogin={handleLogin} isDarkMode={isDarkMode} usersList={users} />;
  }

  // Check RBAC view permissions strictly according to single-view scope rules
  const isAdminViewAllowed = currentRole === 'Admin';
  const isManagerViewAllowed = currentRole === 'Manager';
  const isRHViewAllowed = currentRole === 'RH';
  const isConsultantViewAllowed = currentRole === 'Consultant';

  const allowedTabsByRole: Record<UserRole, ActiveTab[]> = {
    Admin: ['admin-console'],
    Manager: ['dashboard-manager', 'matching-missions'],
    RH: ['dashboard-rh'],
    Consultant: ['dashboard-consultant', 'gestion-cv', 'generation-cv', 'formations', 'matching-missions'],
  };

  useEffect(() => {
    if (!allowedTabsByRole[currentRole].includes(activeTab)) {
      setActiveTab(tabForRole(currentRole));
    }
  }, [currentRole, activeTab]);

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      isDarkMode ? 'bg-[#18181b] text-slate-100' : 'bg-[#F3F2F1] text-[#323130]'
    }`}>
      {/* Top Header */}
      <Header
        currentRole={currentRole}
        selectedConsultant={selectedConsultant}
        consultants={consultants}
        onConsultantChange={setSelectedConsultant}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenRoleModal={() => setIsRoleModalOpen(true)}
        onNavigateTab={setActiveTab}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
      />

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isDarkMode={isDarkMode}
          currentRole={currentRole}
        />

        {/* Dynamic Content View Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'admin-console' && (
              isAdminViewAllowed ? (
                <GestionUsersAdmin
                  users={users}
                  onAddUser={handleAddUser}
                  onUpdateUser={handleUpdateUser}
                  onDeleteUser={handleDeleteUser}
                  isDarkMode={isDarkMode}
                />
              ) : (
                <AccessRestricted
                  requiredRole="Admin"
                  currentRole={currentRole}
                  onOpenRoleModal={() => setIsRoleModalOpen(true)}
                  isDarkMode={isDarkMode}
                />
              )
            )}

            {activeTab === 'dashboard-consultant' && (
              isConsultantViewAllowed ? (
                <DashboardConsultant
                  consultant={selectedConsultant}
                  missions={missions}
                  formations={formations}
                  isDarkMode={isDarkMode}
                  onNavigateTab={setActiveTab}
                />
              ) : (
                <AccessRestricted
                  requiredRole="Manager"
                  currentRole={currentRole}
                  onOpenRoleModal={() => setIsRoleModalOpen(true)}
                  isDarkMode={isDarkMode}
                />
              )
            )}

            {activeTab === 'gestion-cv' && (
              isConsultantViewAllowed ? (
                <GestionCV
                  consultant={selectedConsultant}
                  isDarkMode={isDarkMode}
                  onUpdateConsultantCV={handleUpdateConsultantCV}
                />
              ) : (
                <AccessRestricted
                  requiredRole="Manager"
                  currentRole={currentRole}
                  onOpenRoleModal={() => setIsRoleModalOpen(true)}
                  isDarkMode={isDarkMode}
                />
              )
            )}

            {activeTab === 'generation-cv' && (
              isConsultantViewAllowed ? (
                <GenerationCV
                  consultant={selectedConsultant}
                  isDarkMode={isDarkMode}
                />
              ) : (
                <AccessRestricted
                  requiredRole="Manager"
                  currentRole={currentRole}
                  onOpenRoleModal={() => setIsRoleModalOpen(true)}
                  isDarkMode={isDarkMode}
                />
              )
            )}

            {activeTab === 'formations' && (
              <RecommandationFormations
                consultant={selectedConsultant}
                formations={formations}
                isDarkMode={isDarkMode}
                onStartCourse={handleStartCourse}
                onAddFormation={handleAddFormation}
              />
            )}

            {activeTab === 'matching-missions' && (
              <MatchingMissions
                consultant={selectedConsultant}
                missions={missions}
                isDarkMode={isDarkMode}
                onAddMission={handleAddMission}
              />
            )}


            {activeTab === 'dashboard-manager' && (
              isManagerViewAllowed ? (
                <DashboardManager
                  consultants={consultants}
                  missions={missions}
                  formations={formations}
                  isDarkMode={isDarkMode}
                  onSelectConsultant={setSelectedConsultant}
                  onNavigateTab={setActiveTab}
                  onAddMission={handleAddMission}
                  onAddFormation={handleAddFormation}
                />
              ) : (
                <AccessRestricted
                  requiredRole="Manager"
                  currentRole={currentRole}
                  onOpenRoleModal={() => setIsRoleModalOpen(true)}
                  isDarkMode={isDarkMode}
                />
              )
            )}

            {activeTab === 'dashboard-rh' && (
              isRHViewAllowed ? (
                <DashboardRH
                  consultants={consultants}
                  formations={formations}
                  missions={missions}
                  onAddMission={handleAddMission}
                  onAddFormation={handleAddFormation}
                  isDarkMode={isDarkMode}
                />
              ) : (
                <AccessRestricted
                  requiredRole="RH"
                  currentRole={currentRole}
                  onOpenRoleModal={() => setIsRoleModalOpen(true)}
                  isDarkMode={isDarkMode}
                />
              )
            )}
          </div>
        </main>
      </div>

      {/* Role Management Modal */}
      <RoleManagementModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        currentUser={currentUser}
        users={users}
        onSwitchUser={handleLogin}
        onUpdateUserRole={(userId, newRole) => {
          const u = users.find(x => x.id === userId);
          if (u) {
            handleUpdateUser({ ...u, role: newRole });
          }
        }}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
