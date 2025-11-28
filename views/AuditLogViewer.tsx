import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { AuditLog } from '../types';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    setLogs(StorageService.getAuditLogs());
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 text-white p-6 rounded-xl shadow-md">
        <div className="flex items-center space-x-3 mb-2">
          <ShieldCheck className="h-6 w-6 text-green-400" />
          <h2 className="text-xl font-bold">Auditoria de Segurança</h2>
        </div>
        <p className="text-slate-400">
          Registro imutável de todas as operações sensíveis do sistema.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 font-semibold border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 w-48">Timestamp</th>
                <th className="px-6 py-3 w-48">Ação</th>
                <th className="px-6 py-3">Detalhes</th>
                <th className="px-6 py-3 w-32">Usuário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono text-xs">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 font-bold text-slate-700">{log.action}</td>
                  <td className="px-6 py-3 text-gray-600">{log.details}</td>
                  <td className="px-6 py-3 text-gray-400">{log.user}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                   <td colSpan={4} className="px-6 py-8 text-center text-gray-400">
                     Nenhum log de auditoria registrado ainda.
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
