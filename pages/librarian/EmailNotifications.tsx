
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { User } from '../../types';
import { Button, Input, Card, Select } from '../../components/ui/Layouts';
import { Search, Mail, Key, AlertTriangle, Send, CheckCircle, User as UserIcon, Users, Copy, GraduationCap, Layers } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const EmailNotifications: React.FC = () => {
    const { addToast } = useToast();
    
    // UI State
    const [activeTab, setActiveTab] = useState<'individual' | 'mass'>('individual');
    
    // --- INDIVIDUAL STATE ---
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(false);
    const [emailType, setEmailType] = useState<'credentials' | 'warning' | null>(null);

    // --- MASS STATE ---
    const [massTarget, setMassTarget] = useState<'all_students' | 'class'>('all_students');
    const [selectedClass, setSelectedClass] = useState('');
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [recipientsCount, setRecipientsCount] = useState(0);
    const [recipientEmails, setRecipientEmails] = useState<string[]>([]);
    const [loadingRecipients, setLoadingRecipients] = useState(false);

    // Initial Load for Classes
    useEffect(() => {
        const fetchClasses = async () => {
            const { data } = await supabase.from('aluno').select('turma');
            if (data) {
                const unique = Array.from(new Set(data.map(d => d.turma).filter(Boolean))).sort() as string[];
                setAvailableClasses(unique);
            }
        };
        fetchClasses();
    }, []);

    // Effect for Mass Recipients
    useEffect(() => {
        if (activeTab === 'mass') {
            fetchRecipients();
        }
    }, [activeTab, massTarget, selectedClass]);

    // --- INDIVIDUAL LOGIC ---
    useEffect(() => {
        const searchUsers = async () => {
            if (searchTerm.length < 3) {
                setUsers([]);
                return;
            }
            setLoading(true);
            try {
                const { data: students } = await supabase.from('aluno').select('*').ilike('nome', `%${searchTerm}%`).limit(5);
                const { data: teachers } = await supabase.from('professor').select('*').ilike('nome', `%${searchTerm}%`).limit(5);

                let results: User[] = [];
                if (students) results = [...results, ...students.map(s => ({...s, id: s.matricula, tipo: 'aluno'} as User))];
                if (teachers) results = [...results, ...teachers.map(t => ({...t, tipo: 'professor'} as User))];

                setUsers(results);
            } catch (error) { console.error(error); } finally { setLoading(false); }
        };
        const timeout = setTimeout(searchUsers, 500);
        return () => clearTimeout(timeout);
    }, [searchTerm]);

    const handleSendIndividualEmail = () => {
        if (!selectedUser || !emailType) return;
        if (!selectedUser.email || !selectedUser.email.includes('@')) {
            addToast('Usuário sem e-mail válido cadastrado.', 'error');
            return;
        }

        let subject = '';
        let body = '';

        if (emailType === 'credentials') {
            subject = 'Acesso à Biblioteca Asas do Saber';
            body = `Olá ${selectedUser.nome},\n\nSegue abaixo suas credenciais de acesso ao sistema da biblioteca:\n\nLogin: ${selectedUser.email}\nSenha: ${selectedUser.senha}\n${selectedUser.matricula ? `Matrícula: ${selectedUser.matricula}\n` : ''}\nPor favor, altere sua senha após o primeiro acesso.\n\nAtenciosamente,\nEquipe da Biblioteca`;
        } else {
            subject = 'Aviso Importante - Biblioteca Asas do Saber';
            body = `Olá ${selectedUser.nome},\n\nIdentificamos pendências em seu cadastro ou empréstimos na biblioteca.\nPor favor, compareça à biblioteca para regularizar sua situação o mais breve possível.\n\nAtenciosamente,\nEquipe da Biblioteca`;
        }

        window.location.href = `mailto:${selectedUser.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        addToast('Abrindo aplicativo de e-mail...', 'success');
        setTimeout(() => { setSelectedUser(null); setEmailType(null); setSearchTerm(''); }, 1000);
    };

    // --- MASS LOGIC ---
    const fetchRecipients = async () => {
        setLoadingRecipients(true);
        try {
            let query = supabase.from('aluno').select('email');
            
            if (massTarget === 'class' && selectedClass) {
                query = query.eq('turma', selectedClass);
            }
            
            // Filter out empty emails
            const { data, error } = await query.neq('email', '').not('email', 'is', null);
            
            if (error) throw error;
            
            if (data) {
                const emails = data.map(u => u.email).filter(e => e && e.includes('@'));
                setRecipientEmails(emails);
                setRecipientsCount(emails.length);
            }
        } catch (e) {
            console.error(e);
            addToast('Erro ao buscar e-mails.', 'error');
        } finally {
            setLoadingRecipients(false);
        }
    };

    const handleCopyEmails = () => {
        if (recipientEmails.length === 0) return;
        navigator.clipboard.writeText(recipientEmails.join('; '));
        addToast(`${recipientEmails.length} e-mails copiados! Cole no campo CCO/BCC.`, 'success');
    };

    const handleOpenMassMail = () => {
        if (recipientEmails.length === 0) return;
        
        const subject = 'Bem-vindo à Biblioteca Asas do Saber! 📚';
        const body = `Olá Aluno(a),\n\nSeja muito bem-vindo ao novo sistema da Biblioteca Asas do Saber!\n\nAgora você pode:\n- Consultar nosso acervo online\n- Reservar livros\n- Renovar empréstimos\n- Acompanhar seu histórico de leitura\n\nAcesse o sistema com seu e-mail cadastrado.\n\nBoas leituras!\nEquipe da Biblioteca`;

        // We do NOT put recipients in 'to' to avoid privacy leaks and URL limits.
        // User must copy emails manually or we assume they used the copy button.
        window.location.href = `mailto:?bcc=${recipientEmails.join(',')}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        addToast('Abrindo e-mail. Se a lista for longa, use o botão "Copiar Lista".', 'info');
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 max-w-5xl mx-auto">
            <div className="border-b border-gray-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Mail className="text-indigo-600" /> Central de Notificações
                    </h2>
                    <p className="text-gray-500 mt-1">Gerencie a comunicação com os usuários da biblioteca.</p>
                </div>
                
                {/* Tabs */}
                <div className="bg-gray-100 p-1 rounded-lg flex">
                    <button 
                        onClick={() => setActiveTab('individual')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'individual' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Envio Individual
                    </button>
                    <button 
                        onClick={() => setActiveTab('mass')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'mass' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Em Massa (Boas Vindas)
                    </button>
                </div>
            </div>

            {/* --- INDIVIDUAL TAB --- */}
            {activeTab === 'individual' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-left-4">
                    {/* Left Column: User Selection */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-gray-700">1. Selecione o Usuário</h3>
                        <div className="relative">
                            <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                            <Input 
                                placeholder="Buscar por nome..." 
                                className="pl-10" 
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setSelectedUser(null); }}
                            />
                        </div>

                        {loading && <p className="text-sm text-gray-500 text-center">Buscando...</p>}

                        {!selectedUser && users.length > 0 && (
                            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm max-h-60 overflow-y-auto">
                                {users.map(u => (
                                    <div 
                                        key={u.id} 
                                        onClick={() => { setSelectedUser(u); setUsers([]); }}
                                        className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-gray-100 last:border-0 flex items-center gap-3 transition-colors"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                            {u.nome.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-medium text-gray-800">{u.nome}</p>
                                            <p className="text-xs text-gray-500 capitalize">{u.tipo} • {u.email}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedUser && (
                            <Card className="bg-indigo-50 border-indigo-200 p-4 relative">
                                <button onClick={() => setSelectedUser(null)} className="absolute top-2 right-2 text-indigo-400 hover:text-indigo-700 text-sm font-medium">Trocar</button>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-12 h-12 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700">
                                        <UserIcon size={24} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-indigo-900">{selectedUser.nome}</h4>
                                        <p className="text-sm text-indigo-700">{selectedUser.email}</p>
                                    </div>
                                </div>
                            </Card>
                        )}
                    </div>

                    {/* Right Column: Action */}
                    <div className={`space-y-4 transition-opacity duration-300 ${selectedUser ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                        <h3 className="font-semibold text-gray-700">2. Escolha o Modelo</h3>
                        
                        <div className="grid grid-cols-1 gap-4">
                            <button onClick={() => setEmailType('credentials')} className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${emailType === 'credentials' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 bg-white'}`}>
                                <div className={`p-2 rounded-full ${emailType === 'credentials' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}><Key size={20} /></div>
                                <div><h4 className={`font-bold ${emailType === 'credentials' ? 'text-indigo-900' : 'text-gray-800'}`}>Enviar Credenciais</h4><p className="text-sm text-gray-500 mt-1">Login e senha para primeiro acesso.</p></div>
                                {emailType === 'credentials' && <CheckCircle className="ml-auto text-indigo-600" size={20} />}
                            </button>

                            <button onClick={() => setEmailType('warning')} className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${emailType === 'warning' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-amber-300 bg-white'}`}>
                                <div className={`p-2 rounded-full ${emailType === 'warning' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'}`}><AlertTriangle size={20} /></div>
                                <div><h4 className={`font-bold ${emailType === 'warning' ? 'text-amber-900' : 'text-gray-800'}`}>Aviso de Pendência</h4><p className="text-sm text-gray-500 mt-1">Cobrança de devolução ou dados.</p></div>
                                {emailType === 'warning' && <CheckCircle className="ml-auto text-amber-600" size={20} />}
                            </button>
                        </div>

                        <div className="pt-4">
                            <Button onClick={handleSendIndividualEmail} className="w-full h-12 text-lg shadow-lg" disabled={!selectedUser || !emailType}>
                                <Send className="mr-2" size={20} /> Abrir Cliente de E-mail
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MASS TAB --- */}
            {activeTab === 'mass' && (
                <div className="animate-in slide-in-from-right-4 space-y-8">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6">
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="flex-1 space-y-4">
                                <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                                    <Users size={20} /> 1. Definir Público Alvo
                                </h3>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <button 
                                        onClick={() => setMassTarget('all_students')}
                                        className={`p-4 rounded-lg border-2 text-left transition-all ${massTarget === 'all_students' ? 'border-indigo-600 bg-white shadow-md' : 'border-transparent bg-white/50 hover:bg-white'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1 text-indigo-700 font-bold">
                                            <GraduationCap size={18} /> Todos os Alunos
                                        </div>
                                        <p className="text-xs text-gray-500">Enviar para toda a base de alunos ativos.</p>
                                    </button>

                                    <button 
                                        onClick={() => setMassTarget('class')}
                                        className={`p-4 rounded-lg border-2 text-left transition-all ${massTarget === 'class' ? 'border-indigo-600 bg-white shadow-md' : 'border-transparent bg-white/50 hover:bg-white'}`}
                                    >
                                        <div className="flex items-center gap-2 mb-1 text-indigo-700 font-bold">
                                            <Layers size={18} /> Por Turma
                                        </div>
                                        <p className="text-xs text-gray-500">Selecionar uma turma específica.</p>
                                    </button>
                                </div>

                                {massTarget === 'class' && (
                                    <div className="mt-4 animate-in fade-in">
                                        <Select 
                                            label="Selecione a Turma"
                                            value={selectedClass}
                                            onChange={e => setSelectedClass(e.target.value)}
                                            options={[{value: '', label: 'Selecione...'}, ...availableClasses.map(c => ({value: c, label: c}))]}
                                        />
                                    </div>
                                )}

                                <div className="mt-4 bg-white p-3 rounded-lg border border-indigo-100 flex items-center justify-between">
                                    <span className="text-sm text-gray-600">Destinatários encontrados:</span>
                                    {loadingRecipients ? (
                                        <span className="text-sm font-bold text-gray-400">Carregando...</span>
                                    ) : (
                                        <span className="text-lg font-bold text-indigo-600">{recipientsCount}</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 space-y-4">
                                <h3 className="font-bold text-indigo-900 flex items-center gap-2">
                                    <Mail size={20} /> 2. Pré-visualização da Mensagem
                                </h3>
                                
                                <div className="bg-white p-4 rounded-lg border border-gray-200 text-sm space-y-3 shadow-sm">
                                    <div>
                                        <span className="text-gray-400 text-xs uppercase font-bold">Assunto:</span>
                                        <p className="font-medium text-gray-800">Bem-vindo à Biblioteca Asas do Saber! 📚</p>
                                    </div>
                                    <hr className="border-gray-100"/>
                                    <div>
                                        <span className="text-gray-400 text-xs uppercase font-bold">Corpo:</span>
                                        <p className="text-gray-600 mt-1 whitespace-pre-line">
                                            Olá Aluno(a),
                                            <br/><br/>
                                            Seja muito bem-vindo ao novo sistema da Biblioteca Asas do Saber!
                                            <br/><br/>
                                            Agora você pode consultar acervo, reservar livros e ver seu histórico online.
                                            <br/>
                                            Acesse com seu e-mail cadastrado.
                                            <br/><br/>
                                            Boas leituras!<br/>
                                            Equipe da Biblioteca
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-end pt-6 border-t border-blue-200/50">
                            <Button 
                                variant="outline" 
                                className="bg-white hover:bg-gray-50" 
                                onClick={handleCopyEmails}
                                disabled={recipientsCount === 0}
                            >
                                <Copy size={18} className="mr-2 text-gray-500" />
                                Copiar Lista de E-mails (Para CCO)
                            </Button>
                            
                            <Button 
                                onClick={handleOpenMassMail}
                                disabled={recipientsCount === 0}
                                className="shadow-lg shadow-indigo-200"
                            >
                                <Send size={18} className="mr-2" />
                                Abrir E-mail (Mensagem Pronta)
                            </Button>
                        </div>
                        <p className="text-right text-xs text-gray-500 mt-2">
                            Dica: Use "Copiar Lista" e cole no campo <strong>CCO (Cópia Oculta)</strong> do seu e-mail para privacidade.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
