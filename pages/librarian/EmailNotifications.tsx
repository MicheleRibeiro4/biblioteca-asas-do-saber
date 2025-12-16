
import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { User, UserType } from '../../types';
import { Button, Input, Card } from '../../components/ui/Layouts';
import { Search, Mail, Key, AlertTriangle, Send, CheckCircle, User as UserIcon } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

export const EmailNotifications: React.FC = () => {
    const { addToast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(false);
    const [emailType, setEmailType] = useState<'credentials' | 'warning' | null>(null);

    // Search users when typing
    useEffect(() => {
        const searchUsers = async () => {
            if (searchTerm.length < 3) {
                setUsers([]);
                return;
            }
            setLoading(true);
            try {
                // Search in both 'aluno' and 'professor' tables
                const { data: students } = await supabase
                    .from('aluno')
                    .select('*')
                    .ilike('nome', `%${searchTerm}%`)
                    .limit(5);

                const { data: teachers } = await supabase
                    .from('professor')
                    .select('*')
                    .ilike('nome', `%${searchTerm}%`)
                    .limit(5);

                let results: User[] = [];
                if (students) results = [...results, ...students.map(s => ({...s, id: s.matricula, tipo: 'aluno'} as User))];
                if (teachers) results = [...results, ...teachers.map(t => ({...t, tipo: 'professor'} as User))];

                setUsers(results);
            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
            }
        };

        const timeout = setTimeout(searchUsers, 500);
        return () => clearTimeout(timeout);
    }, [searchTerm]);

    const handleSendEmail = () => {
        if (!selectedUser || !emailType) return;
        
        if (!selectedUser.email || !selectedUser.email.includes('@')) {
            addToast('Usuário sem e-mail válido cadastrado.', 'error');
            return;
        }

        let subject = '';
        let body = '';

        if (emailType === 'credentials') {
            subject = 'Acesso à Biblioteca Asas do Saber';
            body = `Olá ${selectedUser.nome},\n\n` +
                   `Segue abaixo suas credenciais de acesso ao sistema da biblioteca:\n\n` +
                   `Login (Email): ${selectedUser.email}\n` +
                   `Senha: ${selectedUser.senha}\n` +
                   (selectedUser.matricula ? `Matrícula: ${selectedUser.matricula}\n` : '') +
                   `\nPor favor, altere sua senha após o primeiro acesso.\n\n` +
                   `Atenciosamente,\nEquipe da Biblioteca`;
        } else {
            subject = 'Aviso Importante - Biblioteca Asas do Saber';
            body = `Olá ${selectedUser.nome},\n\n` +
                   `Identificamos pendências em seu cadastro ou empréstimos na biblioteca.\n` +
                   `Por favor, compareça à biblioteca para regularizar sua situação o mais breve possível.\n\n` +
                   `Atenciosamente,\nEquipe da Biblioteca`;
        }

        const mailtoLink = `mailto:${selectedUser.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        // Open default mail client
        window.location.href = mailtoLink;
        
        addToast('Abrindo aplicativo de e-mail...', 'success');
        
        // Reset state slightly after
        setTimeout(() => {
            setSelectedUser(null);
            setEmailType(null);
            setSearchTerm('');
        }, 1000);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 max-w-4xl mx-auto">
            <div className="border-b border-gray-200 pb-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <Mail className="text-indigo-600" /> Central de Notificações
                </h2>
                <p className="text-gray-500 mt-1">Envie credenciais de acesso ou avisos de cobrança para alunos e professores.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
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
                            <button 
                                onClick={() => setSelectedUser(null)}
                                className="absolute top-2 right-2 text-indigo-400 hover:text-indigo-700 text-sm font-medium"
                            >
                                Trocar
                            </button>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-12 h-12 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700">
                                    <UserIcon size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-indigo-900">{selectedUser.nome}</h4>
                                    <p className="text-sm text-indigo-700">{selectedUser.email}</p>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-2">
                                <span className="bg-white/60 px-2 py-1 rounded text-xs font-medium text-indigo-800 capitalize border border-indigo-100">
                                    {selectedUser.tipo}
                                </span>
                                {selectedUser.turma && (
                                    <span className="bg-white/60 px-2 py-1 rounded text-xs font-medium text-indigo-800 border border-indigo-100">
                                        Turma: {selectedUser.turma}
                                    </span>
                                )}
                            </div>
                        </Card>
                    )}
                </div>

                {/* Right Column: Action Selection */}
                <div className={`space-y-4 transition-opacity duration-300 ${selectedUser ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <h3 className="font-semibold text-gray-700">2. Escolha o Tipo de E-mail</h3>
                    
                    <div className="grid grid-cols-1 gap-4">
                        <button 
                            onClick={() => setEmailType('credentials')}
                            className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${emailType === 'credentials' ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 bg-white'}`}
                        >
                            <div className={`p-2 rounded-full ${emailType === 'credentials' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                <Key size={20} />
                            </div>
                            <div>
                                <h4 className={`font-bold ${emailType === 'credentials' ? 'text-indigo-900' : 'text-gray-800'}`}>Enviar Credenciais</h4>
                                <p className="text-sm text-gray-500 mt-1">Envia o login e a senha cadastrada para o usuário acessar o sistema.</p>
                            </div>
                            {emailType === 'credentials' && <CheckCircle className="ml-auto text-indigo-600" size={20} />}
                        </button>

                        <button 
                            onClick={() => setEmailType('warning')}
                            className={`flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${emailType === 'warning' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-amber-300 bg-white'}`}
                        >
                            <div className={`p-2 rounded-full ${emailType === 'warning' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                <AlertTriangle size={20} />
                            </div>
                            <div>
                                <h4 className={`font-bold ${emailType === 'warning' ? 'text-amber-900' : 'text-gray-800'}`}>Aviso de Pendência</h4>
                                <p className="text-sm text-gray-500 mt-1">Notifica o usuário sobre atrasos na devolução ou problemas cadastrais.</p>
                            </div>
                            {emailType === 'warning' && <CheckCircle className="ml-auto text-amber-600" size={20} />}
                        </button>
                    </div>

                    <div className="pt-4">
                        <Button 
                            onClick={handleSendEmail} 
                            className="w-full h-12 text-lg shadow-lg" 
                            disabled={!selectedUser || !emailType}
                        >
                            <Send className="mr-2" size={20} />
                            Abrir Cliente de E-mail
                        </Button>
                        <p className="text-center text-xs text-gray-400 mt-2">Isso abrirá o aplicativo de e-mail padrão do seu dispositivo.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
