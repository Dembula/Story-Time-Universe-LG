import { useEffect, useRef, useState } from "react";
import { useAppState } from "@/state/AppState";
import { ViewerAPI } from "@/api/viewerApi";
import { ApiError } from "@/api/client";
import type { ContentItem, ViewerProfile } from "@/api/types";
import { backdropCandidates } from "@/api/mediaUrl";
import { RemoteImage } from "@/components/RemoteImage";
import { FocusButton } from "@/components/FocusButton";
import { useRemote } from "@/tv/useRemote";
import { PinPad } from "@/components/PinPad";
import { Logo } from "@/components/Brand";
import { profileColor } from "@/theme";
import { exitApp } from "@/tv/platform";

/**
 * Full-screen "Choose your profile" page. A wide backdrop cover fills the
 * entire 1920x1080 canvas and slowly cross-fades, matching the immersive look
 * the user asked for — the whole screen is the artwork, not a small panel.
 */
export function Profiles() {
  const { selectProfile, signOut, needsPaymentAttention } = useAppState();
  const [profiles, setProfiles] = useState<ViewerProfile[]>([]);
  const [backdrops, setBackdrops] = useState<ContentItem[]>([]);
  const [backdropIndex, setBackdropIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pinProfile, setPinProfile] = useState<ViewerProfile | null>(null);
  const [selectingId, setSelectingId] = useState<string | null>(null);
  const mounted = useRef(true);

  useRemote({ onBack: exitApp });

  useEffect(() => {
    mounted.current = true;
    void load();
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (backdrops.length <= 1) return;
    const id = setInterval(() => {
      setBackdropIndex((i) => (i + 1) % backdrops.length);
    }, 6000);
    return () => clearInterval(id);
  }, [backdrops.length]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setProfiles(await ViewerAPI.fetchProfiles());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load profiles.");
      setProfiles([]);
    }

    const featured = await ViewerAPI.fetchContent({ featured: true, limit: 10 }).catch(() => []);
    const trending = await ViewerAPI.fetchContent({ limit: 16 }).catch(() => []);
    const combined = featured.length ? [...featured, ...trending] : trending;
    const seen = new Set<string>();
    const withArt = combined.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return backdropCandidates(item).length > 0;
    });
    if (mounted.current) {
      setBackdrops(withArt.length ? withArt : combined.slice(0, 8));
      setLoading(false);
    }
  }

  async function select(profile: ViewerProfile) {
    if (profile.pinEnabled) {
      setPinProfile(profile);
      return;
    }
    await activate(profile);
  }

  async function activate(profile: ViewerProfile, pin?: string) {
    setSelectingId(profile.id);
    setError(null);
    try {
      const active = await ViewerAPI.activateProfile(profile.id, pin);
      setPinProfile(null);
      selectProfile(active);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not select profile.");
      if (err instanceof ApiError && err.kind === "paymentRequired") setPinProfile(null);
    } finally {
      setSelectingId(null);
    }
  }

  const current = backdrops.length ? backdrops[backdropIndex % backdrops.length] : null;

  return (
    <div className="profiles">
      {/* Full-screen wide backdrop cover */}
      <div className="profiles-backdrop">
        {current ? (
          <RemoteImage
            key={current.id}
            urls={backdropCandidates(current)}
            className="poster-img fade-in"
            alt=""
          />
        ) : (
          <div className="profiles-backdrop-fallback" />
        )}
        <div className="profiles-scrim" />
      </div>

      <div className="profiles-topbar">
        <Logo className="profiles-logo" />
        <FocusButton onEnter={() => void signOut()} className="ghost-btn">
          Sign Out
        </FocusButton>
      </div>

      {current && (
        <div className="profiles-feature">
          <div className="profiles-feature-title">{current.title}</div>
          {current.category && <div className="profiles-feature-sub">{current.category}</div>}
        </div>
      )}

      <div className="profiles-panel">
        <h1 className="profiles-heading">Choose your profile</h1>

        {loading ? (
          <div className="spinner" />
        ) : (
          <div className="profiles-grid">
            {profiles.map((profile, idx) => (
              <ProfileTile
                key={profile.id}
                profile={profile}
                autoFocus={idx === 0}
                loading={selectingId === profile.id}
                onSelect={() => void select(profile)}
              />
            ))}
          </div>
        )}

        {error && <div className="error-text">{error}</div>}

        {needsPaymentAttention && (
          <div className="payment-banner">
            Subscription needs attention — renew on the website. Payments are not taken in the app.
          </div>
        )}
      </div>

      {pinProfile && (
        <PinPad
          title={`Enter PIN for ${pinProfile.name}`}
          onSubmit={(pin) => void activate(pinProfile, pin)}
          onCancel={() => setPinProfile(null)}
        />
      )}
    </div>
  );
}

function ProfileTile({
  profile,
  onSelect,
  loading,
  autoFocus,
}: {
  profile: ViewerProfile;
  onSelect: () => void;
  loading: boolean;
  autoFocus?: boolean;
}) {
  const ageLabel = profile.age <= 12 ? "Kids" : profile.age <= 15 ? "Teen" : "Adult";
  return (
    <FocusButton onEnter={onSelect} className="profile-tile" focusClass="focus-lift" autoFocus={autoFocus}>
      <div className="profile-avatar" style={{ background: profileColor(profile.id) }}>
        {loading ? <div className="spinner small" /> : profile.name.charAt(0).toUpperCase()}
        {profile.pinEnabled && <span className="profile-lock">🔒</span>}
      </div>
      <div className="profile-name">{profile.name}</div>
      <div className="profile-age">{ageLabel}</div>
    </FocusButton>
  );
}
