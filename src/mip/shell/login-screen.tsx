/**
 * Minimal sign-in screen shown after Sign out. mip-tailwind has no real auth yet
 * (see migration-plan: Login is a future item), so this is a lightweight gate:
 * Sign out flips a `mip:signed-out` flag and renders this; "Sign in" clears it
 * and remounts the app. Replace with the real auth flow when it lands.
 */

import { Stars01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";

export function LoginScreen({ onSignIn }: { onSignIn: () => void }) {
    return (
        <div className="flex h-dvh flex-col items-center justify-center gap-6 bg-secondary p-6">
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-primary p-8 ring-1 ring-secondary">
                <span className="flex size-12 items-center justify-center rounded-xl bg-brand-solid">
                    <Stars01 className="size-6 text-white" aria-hidden="true" />
                </span>
                <div className="flex flex-col items-center gap-1 text-center">
                    <h1 className="text-lg font-semibold text-primary">You've been signed out</h1>
                    <p className="max-w-xs text-sm text-tertiary">Sign back in to return to your MIP workspace.</p>
                </div>
                <Button size="md" color="primary" onClick={onSignIn} className="w-full">
                    Sign in
                </Button>
            </div>
        </div>
    );
}
