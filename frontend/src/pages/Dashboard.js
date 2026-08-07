import React, { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavigationMenu } from "../components/NavigationMenu";
import { Profile } from "../components/Profile";
import { About } from "../components/About";
import { Settings } from "../components/Settings";
import { GroupSelector } from "../components/GroupSelector";
import { CreateGroupModal } from "../components/CreateGroupModal";
import { GroupList } from "../components/GroupList";
import { GroupDetails } from "../components/GroupDetails";
import { LoadingState, ErrorBanner } from "../components/AsyncState";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import "./Dashboard.css";

export function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState("home");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(null);

  const fetchGroups = useCallback(() => api.get("/groups"), []);
  const { data: groups, loading, error, refetch } = useAsync(fetchGroups);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleGroupCreated = (newGroup) => {
    setIsCreateGroupModalOpen(false);
    setSelectedGroupId(newGroup.id);
    refetch();
  };

  const renderCurrentView = () => {
    if (currentView === "profile") return <Profile user={user} groups={groups || []} onLogout={handleLogout} />;
    if (currentView === "about") return <About />;
    if (currentView === "settings") return <Settings />;

    if (selectedGroupId) {
      return (
        <GroupDetails
          groupId={selectedGroupId}
          currentUser={user}
          onBack={() => setSelectedGroupId(null)}
          onGroupChanged={refetch}
        />
      );
    }

    if (loading) return <LoadingState label="Loading your groups..." />;
    if (error) return <ErrorBanner error={error} onRetry={refetch} />;

    return (
      <GroupList
        groups={groups || []}
        onCreateGroup={() => setIsCreateGroupModalOpen(true)}
        onOpenGroup={(id) => setSelectedGroupId(id)}
      />
    );
  };

  const selectedGroup = (groups || []).find((g) => g.id === selectedGroupId);

  return (
    <div className="dashboard">
      <NavigationMenu
        isOpen={isMenuOpen}
        onToggle={() => setIsMenuOpen(!isMenuOpen)}
        currentView={currentView}
        onViewChange={(view) => {
          setCurrentView(view);
          // Every nav item, including "Groups", should return to the group
          // list -- otherwise clicking Home while a group is open just
          // closes the menu and leaves you looking at the same group.
          setSelectedGroupId(null);
        }}
        user={user}
      />

      <div className={`dashboard-content ${isMenuOpen ? "menu-open" : ""}`}>
        <header className="dashboard-header">
          <div className="header-left">
            <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>

          <div className="header-center">
            <h1>SplitPay</h1>
            {selectedGroup && (
              <GroupSelector
                groups={groups || []}
                selectedGroupId={selectedGroupId}
                onGroupChange={setSelectedGroupId}
                onCreateGroup={() => setIsCreateGroupModalOpen(true)}
              />
            )}
          </div>

          <div className="header-actions"></div>
        </header>

        <main className="dashboard-main">{renderCurrentView()}</main>
      </div>

      {isCreateGroupModalOpen && (
        <CreateGroupModal onClose={() => setIsCreateGroupModalOpen(false)} onCreateGroup={handleGroupCreated} />
      )}
    </div>
  );
}
