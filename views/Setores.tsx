
import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, Save, X } from 'lucide-react';
import { StorageService } from '../services/storage';
interface Setor { id: number; nome: string; }

export const SetoresView: React.FC = () => {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [novoNome, setNovoNome] = useState('');
  const [editId, setEditId] = useState<number|null>(null);
  const [editNome, setEditNome] = useState('');
  const handleDeleteSetor = (id: number) => {
    if (window.confirm('Deseja realmente apagar este setor?')) {
      StorageService.deleteSetor(id);
      setSetores(StorageService.getSetores());
    }
  };

  const handleEditSetor = (setor: Setor) => {
    setEditId(setor.id);
    setEditNome(setor.nome);
  };

  const handleSaveEdit = (id: number) => {
    if (!editNome.trim()) return;
    const setoresAtualizados = setores.map(s => s.id === id ? { ...s, nome: editNome.trim() } : s);
    localStorage.setItem('biohealth_setores', JSON.stringify(setoresAtualizados));
    setSetores(setoresAtualizados);
    setEditId(null);
    setEditNome('');
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setEditNome('');
  };

  useEffect(() => {
    setSetores(StorageService.getSetores());
  }, []);

  const handleAddSetor = () => {
    if (!novoNome.trim()) return;
    StorageService.saveSetor(novoNome.trim());
    setSetores(StorageService.getSetores());
    setNovoNome('');
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">Setores</h2>
      <div className="flex gap-2 mb-6">
        <input
          className="border rounded px-3 py-2 flex-1"
          placeholder="Nome do setor"
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
        />
        <button
          className="bg-green-600 text-white px-4 py-2 rounded font-semibold"
          onClick={handleAddSetor}
        >
          Novo Setor
        </button>
      </div>
      <ul className="space-y-2">
        {setores.map(setor => (
          <li key={setor.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded border">
            <span className="font-mono bg-gray-200 px-2 py-1 rounded text-xs">{setor.id}</span>
            {editId === setor.id ? (
              <>
                <input
                  className="border rounded px-2 py-1 flex-1"
                  value={editNome}
                  onChange={e => setEditNome(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(setor.id); if (e.key === 'Escape') handleCancelEdit(); }}
                  autoFocus
                />
                <button className="text-green-600 hover:bg-green-100 rounded p-1" onClick={() => handleSaveEdit(setor.id)} title="Salvar"><Save className="w-4 h-4" /></button>
                <button className="text-gray-500 hover:bg-gray-100 rounded p-1" onClick={handleCancelEdit} title="Cancelar"><X className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <span className="font-medium flex-1">{setor.nome}</span>
                <button className="text-blue-600 hover:bg-blue-100 rounded p-1" onClick={() => handleEditSetor(setor)} title="Editar"><Edit2 className="w-4 h-4" /></button>
                <button className="text-red-600 hover:bg-red-100 rounded p-1" onClick={() => handleDeleteSetor(setor.id)} title="Apagar"><Trash2 className="w-4 h-4" /></button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
