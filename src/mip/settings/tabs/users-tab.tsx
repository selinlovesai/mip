/** Users settings tab — workspace members (mock list). */

import { Avatar } from "@/components/base/avatar/avatar";
import { Badge } from "@/components/base/badges/badges";
import { Button } from "@/components/base/buttons/button";

const USERS = [
    { name: "Super Admin", email: "superadmin@protocol.dev", role: "Admin", tone: "brand" as const },
    { name: "Olivia Rhye", email: "olivia@acme.com", role: "Editor", tone: "blue" as const },
    { name: "Phoenix Baker", email: "phoenix@globex.com", role: "Viewer", tone: "gray" as const },
];

export function UsersTab() {
    return (
        <div className="flex flex-col gap-8">
            <header className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-xl font-semibold text-primary">Users</h1>
                    <p className="mt-1 text-sm text-tertiary">People with access to this workspace.</p>
                </div>
                <Button color="primary" size="md">
                    Invite
                </Button>
            </header>

            <ul className="flex flex-col divide-y divide-border-secondary rounded-xl ring-1 ring-secondary">
                {USERS.map((u) => (
                    <li key={u.email} className="flex items-center gap-3 px-4 py-3">
                        <Avatar size="md" initials={u.name.split(" ").map((p) => p[0]).join("")} />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-secondary">{u.name}</p>
                            <p className="truncate text-xs text-tertiary">{u.email}</p>
                        </div>
                        <Badge type="pill-color" color={u.tone} size="sm">
                            {u.role}
                        </Badge>
                    </li>
                ))}
            </ul>
        </div>
    );
}
