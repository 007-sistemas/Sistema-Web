
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
interface Setor { id: number; nome: string; }

export const SetoresView: React.FC = () => {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [novoNome, setNovoNome] = useState('');

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
            <span className="font-medium">{setor.nome}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
