import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type Role = "ADMIN" | "STAFF" | "DRIVER" | "STUDENT";

const ROLES: Role[] = ["ADMIN", "STAFF", "DRIVER", "STUDENT"];

export default function AdminGate() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>(() => {
    const existing = typeof window !== "undefined" ? window.sessionStorage.getItem("demoRole") : null;
    return (existing as Role) || "ADMIN";
  });

  // If already set to ADMIN/STAFF, send straight to resources
  useEffect(() => {
    if (role && (role === "ADMIN" || role === "STAFF")) {
      // do nothing; user will click Continue — or uncomment next line to auto-forward:
      // navigate("/admin/resources");
    }
  }, [role]);

  const saveAndGo = () => {
    window.sessionStorage.setItem("demoRole", role);
    if (role === "ADMIN" || role === "STAFF") {
      navigate("/admin/resources");
    } else {
      // Non-staff roles don’t have admin pages — go home
      navigate("/");
    }
  };

  const signOut = () => {
    window.sessionStorage.removeItem("demoRole");
    setRole("ADMIN");
  };

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Admin / Staff Sign In</h1>
          <p className="text-sm text-gray-600">
            Temporary gate for testing. Choose a role to access admin pages. Only <strong>ADMIN</strong> and <strong>STAFF</strong> can use the Resource Manager.
          </p>
        </div>

        <label className="block">
          <span className="text-sm text-gray-700">Role</span>
          <select
            className="mt-1 w-full border rounded-lg p-2"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center justify-between gap-2">
          <button className="rounded-xl border px-4 py-2" onClick={saveAndGo}>
            Continue
          </button>
          <button className="text-sm text-gray-600 hover:underline" onClick={signOut}>
            Clear role
          </button>
        </div>

        <div className="text-xs text-gray-500 border-t pt-3">
          Current role in session:{" "}
          <code className="px-1 py-0.5 bg-gray-100 rounded">
            {typeof window !== "undefined" ? window.sessionStorage.getItem("demoRole") ?? "none" : "none"}
          </code>
        </div>
      </div>
    </div>
  );
}
