/** Profile settings tab — account fields persisted to the settings store. */

import { useEffect, useState } from "react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";
import { useSettings } from "../settings-store";

function initialsOf(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "U";
    return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function ProfileTab() {
    const { profile, setProfile } = useSettings();
    const [name, setName] = useState(profile.name);
    const [email, setEmail] = useState(profile.email);
    const [saved, setSaved] = useState(false);

    // Keep local fields in sync if the store changes elsewhere.
    useEffect(() => {
        setName(profile.name);
        setEmail(profile.email);
    }, [profile.name, profile.email]);

    const save = () => {
        setProfile({ name: name.trim() || "User", email: email.trim() });
        setSaved(true);
    };

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-xl font-semibold text-primary">Profile</h1>
                <p className="mt-1 text-sm text-tertiary">Your account details.</p>
            </header>

            <div className="flex items-center gap-4">
                <Avatar size="xl" initials={initialsOf(name)} />
                <div>
                    <p className="text-sm font-semibold text-primary">{name}</p>
                    <p className="text-sm text-tertiary">{email}</p>
                </div>
            </div>

            <div className="flex max-w-md flex-col gap-4">
                <Input label="Name" value={name} onChange={(v) => { setName(v); setSaved(false); }} />
                <Input label="Email" type="email" value={email} onChange={(v) => { setEmail(v); setSaved(false); }} />
            </div>

            <div className="flex items-center gap-3">
                <Button color="primary" size="md" onClick={save}>
                    Save changes
                </Button>
                {saved ? <span className="text-sm text-utility-success-500">Saved ✓</span> : null}
            </div>
        </div>
    );
}
