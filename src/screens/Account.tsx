import { useAppState } from "@/state/AppState";
import { useNavigation } from "@/state/Navigation";
import { FocusButton } from "@/components/FocusButton";
import { useRemote } from "@/tv/useRemote";
import { AppConfig } from "@/config";
import { openInBrowser } from "@/tv/platform";

export function Account({ onExit }: { onExit: () => void }) {
  const { session, subscription, activeProfile, signOut, needsPaymentAttention } = useAppState();
  const { switchProfile, back } = useNavigation();

  useRemote({ onBack: back });

  const planLabel = subscription?.plan ?? "—";
  const statusLabel = subscription?.status ?? "Unknown";
  const renews = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
    : null;

  return (
    <div className="page page-pad-top account" data-scroll="page">
      <h1 className="screen-title">Account</h1>

      <div className="account-card">
        <div className="account-row">
          <span className="account-label">Signed in as</span>
          <span className="account-value">{session?.user?.email ?? session?.user?.name ?? "—"}</span>
        </div>
        <div className="account-row">
          <span className="account-label">Profile</span>
          <span className="account-value">{activeProfile?.name ?? "—"}</span>
        </div>
        <div className="account-row">
          <span className="account-label">Plan</span>
          <span className="account-value">{planLabel}</span>
        </div>
        <div className="account-row">
          <span className="account-label">Status</span>
          <span className={`account-value ${needsPaymentAttention ? "warn" : "ok"}`}>{statusLabel}</span>
        </div>
        {renews && (
          <div className="account-row">
            <span className="account-label">Renews</span>
            <span className="account-value">{renews}</span>
          </div>
        )}
      </div>

      <p className="account-note">
        Payments and plan changes are handled on the website — they are never taken inside the app.
      </p>

      <div className="account-actions">
        <FocusButton onEnter={() => openInBrowser(AppConfig.accountURL)} className="btn btn-secondary" autoFocus>
          Manage on Web
        </FocusButton>
        <FocusButton onEnter={() => openInBrowser(AppConfig.changePlanURL)} className="btn btn-secondary">
          Change Plan
        </FocusButton>
        {needsPaymentAttention && (
          <FocusButton onEnter={() => openInBrowser(AppConfig.renewSubscriptionURL)} className="btn btn-primary">
            Renew Subscription
          </FocusButton>
        )}
        <FocusButton onEnter={switchProfile} className="btn btn-secondary">
          Switch Profile
        </FocusButton>
        <FocusButton onEnter={() => void signOut()} className="btn btn-secondary">
          Sign Out
        </FocusButton>
        <FocusButton onEnter={onExit} className="btn btn-secondary">
          Exit App
        </FocusButton>
      </div>
    </div>
  );
}
