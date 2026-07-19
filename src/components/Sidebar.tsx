import { useState } from "react";
import { useNavigation, type Tab } from "@/state/Navigation";
import { useFocusable } from "@/tv/useFocusable";
import { LogoMark } from "@/components/Brand";

interface NavDef {
  id: Tab;
  label: string;
  icon: string;
}

const NAV: NavDef[] = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "search", label: "Search", icon: "⌕" },
  { id: "mylist", label: "My List", icon: "+" },
  { id: "account", label: "Account", icon: "☰" },
];

export function Sidebar() {
  const { tab, setTab } = useNavigation();
  const [expanded, setExpanded] = useState(false);

  return (
    <nav
      className={`sidebar ${expanded ? "expanded" : ""}`}
      onFocus={() => setExpanded(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setExpanded(false);
      }}
    >
      <div className="sidebar-logo">
        <LogoMark className="mark" />
        <div className="word">Story Time</div>
      </div>

      {NAV.map((item) => (
        <SidebarItem
          key={item.id}
          def={item}
          active={tab === item.id}
          onEnter={() => setTab(item.id)}
          onFocus={() => setExpanded(true)}
          onBlur={() => setExpanded(false)}
        />
      ))}
    </nav>
  );
}

function SidebarItem({
  def,
  active,
  onEnter,
  onFocus,
  onBlur,
}: {
  def: NavDef;
  active: boolean;
  onEnter: () => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  const { ref, focused } = useFocusable<HTMLButtonElement>({
    onEnter,
    onFocus,
    onBlur,
  });

  return (
    <button
      ref={ref}
      type="button"
      onClick={onEnter}
      className={`nav-item tv-focusable ${active ? "active" : ""} ${focused ? "tv-focused" : ""}`}
    >
      <span className="icon">{def.icon}</span>
      <span className="label">{def.label}</span>
    </button>
  );
}
