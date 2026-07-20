import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Shield, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface UserTeam {
  clubId: string;
  clubName: string;
}

interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
  teams: UserTeam[];
}

interface Club {
  id: string;
  name: string;
  teamName: string | null;
}

interface Player {
  id: string;
  firstName: string;
  lastName: string;
  shirtNumber: number | null;
  primaryPosition: string;
}

/**
 * Manage Users page — admin only.
 * Lists all users and provides a form to create new coach/admin accounts.
 */
export function ManageUsersPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [squadPlayers, setSquadPlayers] = useState<Player[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('coach');
  const [clubId, setClubId] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [createNewTeam, setCreateNewTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamAgeGroup, setNewTeamAgeGroup] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      const data = await api.get<UserRecord[]>('/auth/users');
      setUsers(data);
    } catch (err) {
      console.error('Failed to fetch users', err);
    }
  }, []);

  const fetchClubs = useCallback(async () => {
    try {
      const data = await api.get<Club[]>('/auth/clubs');
      setClubs(data);
    } catch (err) {
      console.error('Failed to fetch clubs', err);
    }
  }, []);

  const fetchPlayers = useCallback(async () => {
    try {
      const res = await api.get<{ data: Player[]; count: number }>('/players');
      setSquadPlayers(res.data ?? []);
    } catch (err) {
      console.error('Failed to fetch players', err);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([fetchUsers(), fetchClubs(), fetchPlayers()]).finally(() => setIsLoading(false));
  }, [isAdmin, fetchUsers, fetchClubs, fetchPlayers]);

  const resetForm = () => {
    setEmail('');
    setFirstName('');
    setLastName('');
    setPassword('');
    setRole('coach');
    setClubId('');
    setPlayerId('');
    setCreateNewTeam(false);
    setNewTeamName('');
    setNewTeamAgeGroup('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      let assignClubId = clubId || undefined;

      // If creating a new team, call POST /api/clubs first
      if (createNewTeam) {
        if (!newTeamName.trim()) {
          setErrorMessage('Team name is required when creating a new team');
          setIsSubmitting(false);
          return;
        }
        const clubRes = await api.post<{ data: Club }>('/clubs', {
          name: newTeamName.trim(),
          teamName: newTeamName.trim(),
          ageGroup: newTeamAgeGroup || undefined,
        });
        assignClubId = clubRes.data.id;
      }

      await api.post('/auth/register', {
        email,
        password,
        firstName,
        lastName,
        role,
        clubId: assignClubId,
        playerId: role === 'parent' ? playerId || undefined : undefined,
      });

      setSuccessMessage(
        `User "${firstName} ${lastName}" created successfully. Temporary password: ${password}`
      );
      resetForm();
      setShowForm(false);
      await Promise.all([fetchUsers(), fetchClubs()]);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 403 — not admin
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h1 className="text-2xl font-bold text-slate-100 mb-2">Access Denied</h1>
        <p className="text-slate-400">You do not have permission to view this page.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-slate-400">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-slate-100">Manage Users</h1>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <UserPlus className="w-4 h-4 mr-2" />
          {showForm ? 'Cancel' : 'Add User'}
        </Button>
      </div>

      {/* Success / Error messages */}
      {successMessage && (
        <div className="bg-green-900/30 border border-green-700 text-green-300 px-4 py-3 rounded-lg">
          {successMessage}
        </div>
      )}
      {errorMessage && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg">
          {errorMessage}
        </div>
      )}

      {/* Create User Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Create New User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="coach@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Temporary Password</Label>
                <Input
                  id="password"
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Set a temporary password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  placeholder="Smith"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="coach">Coach</option>
                  <option value="scout">Scout</option>
                  <option value="parent">Parent</option>
                  <option value="admin">Admin</option>
                </Select>
              </div>
              {role === 'parent' && (
                <div className="space-y-2">
                  <Label htmlFor="playerId">Link to Player (Child)</Label>
                  <Select
                    id="playerId"
                    value={playerId}
                    onChange={(e) => setPlayerId(e.target.value)}
                  >
                    <option value="">— Select player —</option>
                    {squadPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.firstName} {p.lastName} {p.shirtNumber ? `(#${p.shirtNumber})` : ''} — {p.primaryPosition}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="clubId">Assign to Club</Label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    id="createNewTeam"
                    checked={createNewTeam}
                    onChange={(e) => {
                      setCreateNewTeam(e.target.checked);
                      if (e.target.checked) setClubId('');
                    }}
                    className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
                  />
                  <Label htmlFor="createNewTeam" className="text-sm text-slate-300 cursor-pointer">
                    Create new team
                  </Label>
                </div>
                {!createNewTeam ? (
                  <Select
                    id="clubId"
                    value={clubId}
                    onChange={(e) => setClubId(e.target.value)}
                  >
                    <option value="">— No club —</option>
                    {clubs.map((club) => (
                      <option key={club.id} value={club.id}>
                        {club.name}{club.teamName ? ` (${club.teamName})` : ''}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <div className="space-y-3">
                    <Input
                      id="newTeamName"
                      type="text"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="e.g. Leeds City Juniors Titans"
                      required={createNewTeam}
                    />
                    <Select
                      id="newTeamAgeGroup"
                      value={newTeamAgeGroup}
                      onChange={(e) => setNewTeamAgeGroup(e.target.value)}
                    >
                      <option value="">— Age group (optional) —</option>
                      <option value="U7">U7</option>
                      <option value="U8">U8</option>
                      <option value="U9">U9</option>
                      <option value="U10">U10</option>
                      <option value="U11">U11</option>
                      <option value="U12">U12</option>
                      <option value="U13">U13</option>
                      <option value="U14">U14</option>
                      <option value="U15">U15</option>
                      <option value="U16">U16</option>
                    </Select>
                  </div>
                )}
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            All Users ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-slate-400 text-center py-4">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Name</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Email</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Role</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium">Club/Team</th>
                    <th className="text-left py-3 px-2 text-slate-400 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                      <td className="py-3 px-2 text-slate-200">
                        {user.firstName} {user.lastName}
                      </td>
                      <td className="py-3 px-2 text-slate-300">{user.email}</td>
                      <td className="py-3 px-2">
                        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-slate-300">
                        {user.teams.length > 0
                          ? user.teams.map((t) => t.clubName).join(', ')
                          : '—'}
                      </td>
                      <td className="py-3 px-2">
                        {user.role !== 'admin' && (
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                const newFirst = prompt('First name:', user.firstName);
                                if (!newFirst) return;
                                const newLast = prompt('Last name:', user.lastName);
                                if (!newLast) return;
                                try {
                                  await api.patch(`/auth/users/${user.id}`, { firstName: newFirst, lastName: newLast });
                                  fetchUsers();
                                  setSuccessMessage(`Updated ${newFirst} ${newLast}`);
                                } catch {}
                              }}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              Edit
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`Delete ${user.firstName} ${user.lastName}?`)) return;
                                try {
                                  await api.delete(`/auth/users/${user.id}`);
                                  fetchUsers();
                                } catch {}
                              }}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
