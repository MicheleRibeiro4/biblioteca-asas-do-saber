
import React, { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { User, UserType } from '../../types';
import { Button, Input, Modal, Select, Badge } from '../../components/ui/Layouts';
import { Plus, Edit2, Trash2, Search, UserCheck, ArrowRightLeft, Power, Filter, X, AlertTriangle, GraduationCap, Briefcase, BookOpenCheck, Archive } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface UserManagementProps { showOverdueOnly?: boolean; }

export const UserManagement: React.FC<UserManagementProps> = ({ showOverdueOnly = false }) => {
    const { addToast } = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [userType, setUserType] = useState<UserType>('aluno');
    const [isOverdueFilter, setIsOverdueFilter] = useState(showOverdueOnly);
    
    // Bulk Actions State
    const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

    // CRUD & Migration Modals State (same as before)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<User> & { senha?: string }>({});
    const [saving, setSaving] = useState(false);
    const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
    const [migrationSourceClass, setMigrationSourceClass] = useState('');
    const [migrationTargetClass, setMigrationTargetClass] = useState('');
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [studentsInSource, setStudentsInSource] = useState<User[]>([]);
    const [selectedMigrationIds, setSelectedMigrationIds] = useState<Set<string>>(new Set());
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean; title: string; message: string; onConfirm: () => void; variant?: 'danger'|'primary'|'success'; confirmText?: string;}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

    useEffect(() => { setIsOverdueFilter(showOverdueOnly); if (showOverdueOnly) setUserType('aluno'); }, [showOverdueOnly]);
    useEffect(() => { loadUsers(); }, [userType, isOverdueFilter]);
    // Clear selection when type changes
    useEffect(() => { setSelectedUsers(new Set()); }, [userType]);

    useEffect(() => {
        if (userType === 'aluno') {
            const fetchClasses = async () => {
                const { data } = await supabase.from('aluno').select('turma');
                if (data) setAvailableClasses(Array.from(new Set(data.map(d => d.turma).filter(Boolean))).sort() as string[]);
            };
            fetchClasses();
        }
    }, [users, userType]);
    
    useEffect(() => {
        if (migrationSourceClass) {
            const fetchStudentsInClass = async () => {
                setLoadingStudents(true);
                const { data } = await supabase.from('aluno').select('*').eq('turma', migrationSourceClass).order('nome');
                if (data) {
                    const mapped = data.map(u => ({ ...u, id: u.matricula, matricula: u.matricula, tipo: 'aluno' })) as User[];
                    setStudentsInSource(mapped);
                    setSelectedMigrationIds(new Set());
                }
                setLoadingStudents(false);
            };
            fetchStudentsInClass();
        } else {
            setStudentsInSource([]);
            setSelectedMigrationIds(new Set());
        }
    }, [migrationSourceClass]);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.from(userType).select('*').order('nome');
            if (error) throw error;
            let normalizedUsers = data?.map(u => {
                const pk = userType === 'aluno' ? u.matricula : u.id;
                return { ...u, id: pk, matricula: u.matricula, tipo: userType };
            }) || [];
            if (isOverdueFilter && userType === 'aluno') {
                const { data: overdueData } = await supabase.from('emprestimo').select('matricula_aluno').eq('status', 'aprovado').is('data_devolucao_real', null).lt('devolutiva', new Date().toISOString());
                if (overdueData) {
                    const overdueMatriculas = new Set(overdueData.map(d => String(d.matricula_aluno)));
                    normalizedUsers = normalizedUsers.filter(u => overdueMatriculas.has(String(u.id)));
                } else { normalizedUsers = []; }
            }
            setUsers(normalizedUsers);
        } catch (error: any) { addToast('Erro ao carregar usuários: ' + error.message, 'error'); } finally { setLoading(false); }
    };

    // Bulk Selection Handlers
    const toggleSelectUser = (id: string) => {
        const newSet = new Set(selectedUsers);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedUsers(newSet);
    };

    const toggleSelectAllUsers = () => {
        if (selectedUsers.size === filteredUsers.length) setSelectedUsers(new Set());
        else setSelectedUsers(new Set(filteredUsers.map(u => String(u.id))));
    };

    // Bulk Action Handlers
    const handleBulkArchive = async () => {
        if (!confirm(`Deseja desativar ${selectedUsers.size} usuários?`)) return;
        const ids = Array.from(selectedUsers);
        try {
            const pk = userType === 'aluno' ? 'matricula' : 'id';
            await supabase.from(userType).update({ status: 'inativo' }).in(pk, ids);
            addToast('Usuários arquivados com sucesso', 'success');
            setSelectedUsers(new Set());
            loadUsers();
        } catch (e) { addToast('Erro ao arquivar', 'error'); }
    };

    const handleBulkDelete = async () => {
        if (!confirm(`ATENÇÃO: Deseja excluir PERMANENTEMENTE ${selectedUsers.size} usuários? Isso não pode ser desfeito.`)) return;
        const ids = Array.from(selectedUsers);
        try {
            const pk = userType === 'aluno' ? 'matricula' : 'id';
            const { error } = await supabase.from(userType).delete().in(pk, ids);
            if (error) {
                if (error.code === '23503') addToast('Alguns usuários possuem histórico e não podem ser excluídos. Tente arquivar.', 'error');
                else throw error;
            } else {
                addToast('Usuários excluídos', 'success');
                setSelectedUsers(new Set());
                loadUsers();
            }
        } catch (e: any) { addToast('Erro ao excluir: ' + e.message, 'error'); }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault(); setSaving(true);
        try {
            const userData = { ...editingUser }; delete userData.tipo; 
            
            // CORRECTION: Prevent overwriting password with empty string on edit
            if (editingUser.id && userData.senha === '') {
                delete userData.senha;
            }

            if (!(userData as any).status) (userData as any).status = 'ativo';
            let error;
            if (editingUser.id) {
                let query = supabase.from(userType).update(userData);
                if (userType === 'aluno') query = query.eq('matricula', String(editingUser.id).trim());
                else query = query.eq('id', editingUser.id);
                const result = await query; error = result.error;
            } else {
                if (!userData.senha) userData.senha = '1234'; 
                const result = await supabase.from(userType).insert([userData]); error = result.error;
            }
            if (error) throw error;
            addToast('Salvo com sucesso!', 'success'); setIsModalOpen(false); loadUsers();
        } catch (err: any) { addToast(`Erro: ${err.message}`, 'error'); } finally { setSaving(false); }
    };

    const handleDeleteClick = (targetUser: User) => {
        if(!targetUser.id && editingUser.id) targetUser = { ...targetUser, id: editingUser.id, tipo: userType } as User;
        setConfirmConfig({ isOpen: true, title: 'Confirmar Exclusão', message: 'Excluir usuário?', variant: 'danger', confirmText: 'Excluir', onConfirm: () => performDelete(targetUser) });
    };

    const performDelete = async (targetUser: User) => {
        const pkColumn = userType === 'aluno' ? 'matricula' : 'id';
        const pkValue = userType === 'aluno' ? String(targetUser.id).trim() : targetUser.id;
        try {
            const { data, error } = await supabase.from(userType).delete().eq(pkColumn, pkValue).select();
            if (error) throw error;
            if (!data || data.length === 0) { setConfirmConfig({ isOpen: true, title: 'Permissão Negada', message: 'Tente desativar.', variant: 'primary', confirmText: 'Desativar', onConfirm: () => performToggleStatus(targetUser) }); return; }
            addToast('Removido com sucesso', 'success'); setIsModalOpen(false); loadUsers();
        } catch (err: any) {
            if (err.code === '23503') setConfirmConfig({ isOpen: true, title: 'Bloqueado', message: 'Possui histórico. Desativar?', variant: 'primary', confirmText: 'Sim, Desativar', onConfirm: () => performToggleStatus(targetUser) });
            else addToast(`Erro: ${err.message}`, 'error');
        }
    };

    const handleToggleStatusClick = (user: User) => {
        if(!user.id && editingUser.id) user = { ...user, id: editingUser.id, tipo: userType } as User;
        const isActive = (user as any).status !== 'inativo';
        setConfirmConfig({ isOpen: true, title: 'Alterar Status', message: isActive ? 'Desativar acesso?' : 'Reativar acesso?', variant: isActive ? 'danger' : 'success', confirmText: isActive ? 'Desativar' : 'Ativar', onConfirm: () => performToggleStatus(user) });
    };

    const performToggleStatus = async (user: User) => {
        try {
            const currentStatus = (user as any).status === 'inativo' ? 'ativo' : 'inativo';
            let query = supabase.from(userType).update({ status: currentStatus });
            if (userType === 'aluno') query = query.eq('matricula', String(user.id).trim()); else query = query.eq('id', user.id);
            const { data, error } = await query.select(); 
            if (error) throw error;
            if (!data || data.length === 0) { addToast('Erro RLS.', 'error'); return; }
            addToast('Status alterado', 'success'); setIsModalOpen(false); loadUsers(); 
        } catch (err: any) { addToast('Erro: ' + err.message, 'error'); }
    };
    
    // Migration Logic
    const toggleStudentSelection = (m: string) => { const n=new Set(selectedMigrationIds); if(n.has(m))n.delete(m);else n.add(m); setSelectedMigrationIds(n); };
    
    const toggleSelectAllMigration = () => {
        if (selectedMigrationIds.size === studentsInSource.length) {
            setSelectedMigrationIds(new Set());
        } else {
            setSelectedMigrationIds(new Set(studentsInSource.map(s => String(s.matricula))));
        }
    };

    const handleMigrationClick = () => { 
        if(!migrationSourceClass || !migrationTargetClass || selectedMigrationIds.size === 0) { addToast('Dados incompletos', 'error'); return; }
        setConfirmConfig({ isOpen: true, title: 'Confirmar Migração', message: `Mover ${selectedMigrationIds.size} alunos?`, confirmText: 'Migrar', variant: 'primary', onConfirm: performMigration }); 
    };
    
    const performMigration = async () => {
        setSaving(true); try {
            const ids = Array.from(selectedMigrationIds).map(id=>String(id).trim());
            const {data, error} = await supabase.from('aluno').update({turma: migrationTargetClass}).in('matricula', ids).select();
            if(error)throw error; if(!data?.length){ addToast('Falha RLS', 'error'); return; }
            addToast('Migração concluída', 'success'); setIsMigrationModalOpen(false); setMigrationSourceClass(''); setMigrationTargetClass(''); setSelectedMigrationIds(new Set()); loadUsers();
        } catch(e:any){ addToast(e.message, 'error'); } finally { setSaving(false); }
    };

    const filteredUsers = users.filter(u => u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || (String(u.id).includes(searchTerm)));
    const openModal = (user?: User) => { if (user) setEditingUser({ ...user, senha: '' }); else setEditingUser({ tipo: userType }); setIsModalOpen(true); };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 relative max-w-[100vw] overflow-hidden">
            {/* Bulk Action Bar - Floating */}
            {selectedUsers.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-6 animate-in slide-in-from-bottom-5 w-[90%] md:w-auto justify-between md:justify-start">
                    <span className="font-medium whitespace-nowrap">{selectedUsers.size} sel.</span>
                    <div className="flex items-center gap-4">
                        <button onClick={handleBulkArchive} className="flex items-center gap-2 hover:text-indigo-400 transition-colors">
                            <Archive size={18} /> <span className="hidden sm:inline">Arquivar</span>
                        </button>
                        <button onClick={handleBulkDelete} className="flex items-center gap-2 hover:text-red-400 transition-colors">
                            <Trash2 size={18} /> <span className="hidden sm:inline">Excluir</span>
                        </button>
                        <button onClick={() => setSelectedUsers(new Set())} className="p-1 hover:bg-gray-800 rounded-full"><X size={16}/></button>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><UserCheck className="text-indigo-600" /> <span className="hidden sm:inline">Gerenciamento de</span> Usuários</h2>
                    <p className="text-gray-500 text-sm mt-1">Administre alunos, professores e bibliotecários.</p>
                </div>
                <div className="bg-white p-1 rounded-xl border border-gray-200 shadow-sm flex items-center w-full md:w-auto overflow-x-auto">
                    {(['aluno', 'professor', 'bibliotecario'] as UserType[]).map((type) => (
                        <button key={type} onClick={() => { setUserType(type); setIsOverdueFilter(false); }} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${userType === type ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>
                            {type === 'aluno' && <GraduationCap size={16} />} {type === 'professor' && <BookOpenCheck size={16} />} {type === 'bibliotecario' && <Briefcase size={16} />}
                            <span className="capitalize hidden sm:inline">{type === 'bibliotecario' ? 'Bibliotecários' : type === 'professor' ? 'Professores' : 'Alunos'}</span>
                            <span className="capitalize sm:hidden">{type.slice(0,4)}...</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Actions Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-col lg:flex-row gap-4 justify-between items-center">
                <div className="relative flex-1 w-full lg:max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input type="text" placeholder={`Buscar ${userType}...`} className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="flex gap-2 w-full lg:w-auto justify-end">
                    {userType === 'aluno' && <Button variant="outline" onClick={() => setIsMigrationModalOpen(true)} className="flex-1 lg:flex-none justify-center"><ArrowRightLeft size={18} className="mr-2" /> Migrar</Button>}
                    <Button onClick={() => openModal()} className="shadow-md shadow-indigo-100 flex-1 lg:flex-none justify-center"><Plus size={18} className="mr-2" /> Novo</Button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th className="w-12 px-6 py-4"><input type="checkbox" onChange={toggleSelectAllUsers} checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/></th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Usuário</th>
                                {userType === 'aluno' && <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Turma</th>}
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">{userType === 'aluno' ? 'Matrícula' : 'ID'}</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {loading ? <tr><td colSpan={6} className="p-8 text-center">Carregando...</td></tr> : filteredUsers.map((user) => {
                                const isActive = (user as any).status !== 'inativo';
                                const idStr = String(user.id);
                                return (
                                    <tr key={idStr} onClick={() => openModal(user)} className={`group hover:bg-indigo-50/30 cursor-pointer ${!isActive ? 'opacity-60 bg-gray-50' : ''}`}>
                                        <td className="px-6 py-4" onClick={e => e.stopPropagation()}>
                                            <input type="checkbox" checked={selectedUsers.has(idStr)} onChange={() => toggleSelectUser(idStr)} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold border-2 ${user.foto_perfil_url ? 'border-indigo-100' : 'border-white bg-indigo-100 text-indigo-600'}`}>
                                                    {user.foto_perfil_url ? <img className="h-full w-full rounded-full object-cover" src={user.foto_perfil_url} /> : user.nome.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="ml-4"><div className="text-sm font-semibold text-gray-900">{user.nome}</div><div className="text-xs text-gray-500">{user.email}</div></div>
                                            </div>
                                        </td>
                                        {userType === 'aluno' && <td className="px-6 py-4"><Badge variant="default">{user.turma || 'N/A'}</Badge></td>}
                                        <td className="px-6 py-4 text-sm text-gray-500 font-mono">{idStr}</td>
                                        <td className="px-6 py-4 text-center"><Badge variant={isActive ? 'success' : 'danger'}>{isActive ? 'ATIVO' : 'INATIVO'}</Badge></td>
                                        <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => handleToggleStatusClick(user)} className={`p-2 rounded-lg ${isActive ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'}`}><Power size={18} /></button>
                                                <button onClick={() => openModal(user)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 size={18} /></button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

             <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser.id ? `Editar ${userType}` : `Novo ${userType}`}>
                <form onSubmit={handleSave} className="space-y-4">
                    <Input label="Nome" value={editingUser.nome || ''} onChange={e => setEditingUser({...editingUser, nome: e.target.value})} required />
                    <Input label="Email" value={editingUser.email || ''} onChange={e => setEditingUser({...editingUser, email: e.target.value})} required />
                    {userType === 'aluno' && <div className="grid grid-cols-2 gap-4"><Input label="Matrícula" value={editingUser.matricula || ''} onChange={e => setEditingUser({...editingUser, matricula: e.target.value})} disabled={!!editingUser.id} /><Input label="Turma" value={editingUser.turma || ''} onChange={e => setEditingUser({...editingUser, turma: e.target.value})} /></div>}
                    {userType === 'professor' && <Input label="Turma" value={editingUser.turma || ''} onChange={e => setEditingUser({...editingUser, turma: e.target.value})} />}
                    <Input 
                        label="Senha" 
                        type="password" 
                        value={editingUser.senha || ''} 
                        onChange={e => setEditingUser({...editingUser, senha: e.target.value})} 
                        placeholder={editingUser.id ? "Deixe em branco para não alterar" : "Obrigatório"}
                    />
                    <div className="flex justify-end gap-2 mt-4">
                         {editingUser.id && <Button type="button" variant="ghost" className="text-red-500 mr-auto" onClick={() => handleDeleteClick(editingUser as User)}>Excluir</Button>}
                         <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                         <Button type="submit" isLoading={saving}>Salvar</Button>
                    </div>
                </form>
            </Modal>
            
            <Modal isOpen={isMigrationModalOpen} onClose={() => setIsMigrationModalOpen(false)} title="Migração em Massa">
                 <div className="space-y-4">
                    <div className="bg-indigo-50 p-3 rounded-lg text-sm text-indigo-800 border border-indigo-100 flex gap-2">
                        <AlertTriangle className="flex-shrink-0 w-5 h-5" />
                        <p>Selecione a turma de origem, a de destino e marque os alunos que devem ser transferidos.</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <Select label="Turma de Origem" options={[{value: '', label: 'Selecione...'}, ...availableClasses.map(c => ({label: c, value: c}))]} value={migrationSourceClass} onChange={e => setMigrationSourceClass(e.target.value)} />
                        <Input label="Turma de Destino" placeholder="Ex: 3A" value={migrationTargetClass} onChange={e => setMigrationTargetClass(e.target.value)} />
                    </div>

                    {studentsInSource.length > 0 && (
                        <div className="space-y-1">
                            <div className="flex justify-between items-center mb-1 px-1">
                                <label className="text-sm font-medium text-gray-700">Selecione os Alunos ({studentsInSource.length}):</label>
                                <button 
                                    type="button" 
                                    onClick={toggleSelectAllMigration} 
                                    className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-colors"
                                >
                                    {selectedMigrationIds.size === studentsInSource.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                                </button>
                            </div>
                            <div className="border border-gray-200 rounded-lg h-60 overflow-y-auto p-2 bg-gray-50 scrollbar-thin scrollbar-thumb-gray-300">
                                {studentsInSource.map(s => (
                                    <label key={String(s.matricula)} className="flex items-center gap-3 p-2 hover:bg-white rounded-md cursor-pointer transition-colors border border-transparent hover:border-gray-100 group">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedMigrationIds.has(String(s.matricula))} 
                                            onChange={() => toggleStudentSelection(String(s.matricula))}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className={`text-sm group-hover:text-gray-900 ${selectedMigrationIds.has(String(s.matricula)) ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>{s.nome}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="text-right text-xs text-gray-500">
                                {selectedMigrationIds.size} alunos selecionados para migração
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                        <Button variant="secondary" onClick={() => setIsMigrationModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleMigrationClick} isLoading={saving} disabled={selectedMigrationIds.size === 0}>
                            Migrar Alunos
                        </Button>
                    </div>
                 </div>
            </Modal>
            
            <Modal isOpen={confirmConfig.isOpen} onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })} title={confirmConfig.title}>
                <div className="space-y-6 text-center">
                    <p className="text-gray-600">{confirmConfig.message}</p>
                    <div className="flex justify-center gap-4">
                        <Button variant="secondary" onClick={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}>Cancelar</Button>
                        <Button variant={confirmConfig.variant === 'danger' ? 'danger' : 'primary'} onClick={() => { confirmConfig.onConfirm(); setConfirmConfig({ ...confirmConfig, isOpen: false }); }}>{confirmConfig.confirmText || 'Confirmar'}</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};
