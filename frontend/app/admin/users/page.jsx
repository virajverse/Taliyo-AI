"use client";

import { useEffect, useMemo, useState } from "react";
import {
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminDeleteUser,
  adminListRoles,
  adminCreateRole,
  adminUpdateRole,
  adminDeleteRole,
} from "../../lib/api";

function formatDate(dt) {
  try {
    const d = new Date(dt);
    if (!isFinite(d.getTime())) return "-";
    return d.toLocaleString();
  } catch {
    return "-";
  }
}

export default function UsersPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState("");

  // New user form
  const [newUsername, setNewUsername] = useState("");
  const [newRole, setNewRole] = useState("");

  // New role form
  const [roleName, setRoleName] = useState("");
  const [rolePerms, setRolePerms] = useState(""); // comma-separated

  const roleNames = useMemo(() => roles.map(r => r.name), [roles]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [{ items: userItems } = { items: [] }, { items: roleItems } = { items: [] }] = await Promise.all([
          adminListUsers().catch(() => ({ items: [] })),
          adminListRoles().catch(() => ({ items: [] })),
        ]);
        if (!mounted) return;
        setUsers(userItems || []);
        setRoles(roleItems || []);
        if (roleItems && roleItems.length && !newRole) setNewRole(roleItems[0].name);
      } catch (e) {
        setError(e?.response?.data?.detail || e?.message || "Failed to load users/roles");
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  async function refreshUsers() {
    try {
      const { items } = await adminListUsers();
      setUsers(items || []);
    } catch (e) {
      console.error("Failed to refresh users", e);
    }
  }

  async function refreshRoles() {
    try {
      const { items } = await adminListRoles();
      setRoles(items || []);
    } catch (e) {
      console.error("Failed to refresh roles", e);
    }
  }

  async function onCreateUser() {
    const u = newUsername.trim();
    const r = newRole.trim();
    if (!u || !r) return;
    setLoading(true);
    try {
      await adminCreateUser(u, r);
      setNewUsername("");
      await refreshUsers();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  async function onUpdateUser(id, updates) {
    setLoading(true);
    try {
      await adminUpdateUser(id, updates);
      await refreshUsers();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Failed to update user");
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteUser(id) {
    if (!confirm("Delete this user?")) return;
    setLoading(true);
    try {
      await adminDeleteUser(id);
      await refreshUsers();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Failed to delete user");
    } finally {
      setLoading(false);
    }
  }

  async function onCreateRole() {
    const name = roleName.trim();
    const perms = rolePerms.split(',').map(s => s.trim()).filter(Boolean);
    if (!name) return;
    setLoading(true);
    try {
      await adminCreateRole(name, perms);
      setRoleName("");
      setRolePerms("");
      await refreshRoles();
      if (!newRole) setNewRole(name);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Failed to create role");
    } finally {
      setLoading(false);
    }
  }

  async function onUpdateRole(id, updates) {
    setLoading(true);
    try {
      await adminUpdateRole(id, updates);
      await refreshRoles();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Failed to update role");
    } finally {
      setLoading(false);
    }
  }

  async function onDeleteRole(id) {
    if (!confirm("Delete this role? Users with this role will be unaffected until you edit them.")) return;
    setLoading(true);
    try {
      await adminDeleteRole(id);
      await refreshRoles();
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Failed to delete role");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">User & Role Management</h1>

      {error && (
        <div className="border border-red-800 bg-red-900/20 text-red-300 rounded-lg p-3 text-sm">{error}</div>
      )}

      {/* Users */}
      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="card-title">Users</h2>
          <span className="text-xs text-zinc-500">{users.length} total</span>
        </div>

        {/* Create user */}
        <div className="flex flex-col md:flex-row gap-2 md:items-end mb-4">
          <div className="flex-1">
            <label className="text-xs text-zinc-500">Username</label>
            <input className="input" placeholder="e.g. alice" value={newUsername} onChange={(e)=> setNewUsername(e.target.value)} />
          </div>
          <div className="w-full md:w-56">
            <label className="text-xs text-zinc-500">Role</label>
            {roleNames.length ? (
              <select className="select" value={newRole} onChange={(e)=> setNewRole(e.target.value)}>
                {roleNames.map((r)=> <option key={r} value={r}>{r}</option>)}
              </select>
            ) : (
              <input className="input" placeholder="e.g. admin" value={newRole} onChange={(e)=> setNewRole(e.target.value)} />
            )}
          </div>
          <button className="btn-primary" onClick={onCreateUser} disabled={loading || !newUsername.trim() || !newRole.trim()}>Add User</button>
        </div>

        {/* Users list */}
        {users.length === 0 ? (
          <div className="text-sm text-zinc-500">No users found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-400">
                <tr>
                  <th className="text-left font-medium pb-2">Username</th>
                  <th className="text-left font-medium pb-2">Role</th>
                  <th className="text-left font-medium pb-2">Updated</th>
                  <th className="text-right font-medium pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="align-top">
                {users.map((u)=> (
                  <UserRow key={u.id} u={u} roles={roleNames} onUpdate={onUpdateUser} onDelete={onDeleteUser} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Roles */}
      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="card-title">Roles</h2>
          <span className="text-xs text-zinc-500">{roles.length} total</span>
        </div>

        <div className="flex flex-col md:flex-row gap-2 md:items-end mb-4">
          <div className="flex-1">
            <label className="text-xs text-zinc-500">Role name</label>
            <input className="input" placeholder="e.g. admin" value={roleName} onChange={(e)=> setRoleName(e.target.value)} />
          </div>
          <div className="flex-1">
            <label className="text-xs text-zinc-500">Permissions (comma-separated)</label>
            <input className="input" placeholder="e.g. chats:read, kb:manage" value={rolePerms} onChange={(e)=> setRolePerms(e.target.value)} />
          </div>
          <button className="btn-secondary" onClick={onCreateRole} disabled={loading || !roleName.trim()}>Add Role</button>
        </div>

        {roles.length === 0 ? (
          <div className="text-sm text-zinc-500">No roles defined. Create a role above.</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {roles.map((r)=> (
              <RoleCard key={r.id} r={r} onUpdate={onUpdateRole} onDelete={onDeleteRole} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function UserRow({ u, roles, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(u.username || "");
  const [role, setRole] = useState(u.role || (roles[0] || ""));

  const save = async () => {
    await onUpdate(u.id, { username, role });
    setEditing(false);
  };

  return (
    <tr className="border-t border-zinc-800/80">
      <td className="py-2 pr-2">
        {editing ? (
          <input className="input" value={username} onChange={(e)=> setUsername(e.target.value)} />
        ) : (
          <span className="font-medium text-zinc-100">{u.username}</span>
        )}
      </td>
      <td className="py-2 pr-2">
        {editing ? (
          roles && roles.length ? (
            <select className="select" value={role} onChange={(e)=> setRole(e.target.value)}>
              {roles.map((r)=> <option key={r} value={r}>{r}</option>)}
            </select>
          ) : (
            <input className="input" value={role} onChange={(e)=> setRole(e.target.value)} />
          )
        ) : (
          <span className="badge">{u.role || '-'}</span>
        )}
      </td>
      <td className="py-2 pr-2 text-zinc-400">{formatDate(u.updated_at)}</td>
      <td className="py-2 pl-2 text-right space-x-2">
        {editing ? (
          <>
            <button className="btn-primary" onClick={save} disabled={!username.trim() || !role.trim()}>Save</button>
            <button className="btn-secondary" onClick={() => { setEditing(false); setUsername(u.username||""); setRole(u.role||""); }}>Cancel</button>
          </>
        ) : (
          <>
            <button className="btn-secondary" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn-danger" onClick={() => onDelete(u.id)}>Delete</button>
          </>
        )}
      </td>
    </tr>
  );
}

function RoleCard({ r, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(r.name || "");
  const [permsStr, setPermsStr] = useState(Array.isArray(r.permissions) ? r.permissions.join(", ") : "");

  const save = async () => {
    const permissions = permsStr.split(',').map(s => s.trim()).filter(Boolean);
    await onUpdate(r.id, { name, permissions });
    setEditing(false);
  };

  return (
    <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/60">
      {editing ? (
        <div className="space-y-2">
          <div>
            <label className="text-xs text-zinc-500">Role name</label>
            <input className="input" value={name} onChange={(e)=> setName(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-zinc-500">Permissions (comma-separated)</label>
            <input className="input" value={permsStr} onChange={(e)=> setPermsStr(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary" onClick={save} disabled={!name.trim()}>Save</button>
            <button className="btn-secondary" onClick={() => { setEditing(false); setName(r.name||""); setPermsStr(Array.isArray(r.permissions)? r.permissions.join(", ") : ""); }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{r.name || '-'}</h3>
            <div className="text-xs text-zinc-500">{formatDate(r.updated_at)}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(r.permissions || []).length ? (
              r.permissions.map((p,i)=> <span key={i} className="badge">{p}</span>)
            ) : (
              <span className="text-xs text-zinc-500">No permissions</span>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button className="btn-secondary" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn-danger" onClick={() => onDelete(r.id)}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}
