/** Profile settings tab — basic account fields (client-only demo). */

import { useState } from "react";
import { Avatar } from "@/components/base/avatar/avatar";
import { Button } from "@/components/base/buttons/button";
import { Input } from "@/components/base/input/input";

export function ProfileTab() {
    const [name, setName] = useState("Super Admin");
    const [email, setEmail] = useState("superadmin@protocol.dev");
    const [saved, setSaved] = useState(false);

    return (
        <div className="flex flex-col gap-8">
            <header>
                <h1 className="text-xl font-semibold text-primary">Profile</h1>
                <p className="mt-1 text-sm text-tertiary">Your account details.</p>
            </header>

            <div className="flex items-center gap-4">
                <Avatar size="xl" initials="SA" />
                <div>
                    <p className="text-sm font-semibold text-primary">{name}</p>
                    <p className="text-sm text-tertiary">superadmin · Super Admin</p>
                </div>
            </div>

            <div className="flex max-w-md flex-col gap-4">
                <Input label="Name" value={name} onChange={(v) => { setName(v); setSaved(false); }} />
                <Input label="Email" type="email" value={email} onChange={(v) => { setEmail(v); setSaved(false); }} />
            </div>

            <div className="flex items-center gap-3">
                <Button color="primary" size="md" onClick={() => setSaved(true)}>
                    Save changes
                </Button>
                {saved ? <span className="text-sm text-utility-green-500">Saved ✓</span> : null}
            </div>
        </div>
    );
}
