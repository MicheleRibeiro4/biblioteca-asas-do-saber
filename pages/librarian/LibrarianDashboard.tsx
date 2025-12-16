
import React, { useState, useEffect } from 'react';
import { BookManagement } from './BookManagement';
import { UserManagement } from './UserManagement';
import { LoanManagement } from './LoanManagement';
import { CommentsManagement } from './CommentsManagement';
import { supabase } from '../../services/supabase';
import { StatCard, Badge, Button, Card, Select } from '../../components/ui/Layouts';
import { BookOpen, Users, AlertCircle, TrendingUp, Trophy, BarChart3, Download, PieChart, Printer } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to handle image loading for PDF
const getDataUrl = (url: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.src = url;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
            resolve(''); // Resolve empty on error to not break flow
        };
    });
};

// --- Sub-Components Definitions (Moved outside to prevent re-renders and scope issues) ---

const Overview: React.FC<{ stats: any, genreStats: any[], topBooks: any[], classStats: any[], setTab: (t: string) => void, onOverdueClick: () => void }> = ({ stats, genreStats, topBooks, classStats, setTab, onOverdueClick }) => (
    <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Acervo Total" value={stats.totalBooks} icon={<BookOpen size={24} />} color="indigo" onClick={() => setTab('books')} />
            <StatCard title="Leitores Ativos" value={stats.totalUsers} icon={<Users size={24} />} color="emerald" onClick={() => setTab('users')} />
            <StatCard title="Empréstimos Ativos" value={stats.activeLoans} icon={<TrendingUp size={24} />} color="amber" onClick={() => setTab('loans')} />
            <StatCard title="Atrasos" value={stats.overdueLoans} icon={<AlertCircle size={24} />} color="rose" onClick={onOverdueClick} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <Card className="border-none shadow-md p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <PieChart className="text-purple-600" />
                        <h3 className="font-bold text-gray-800">Gêneros Mais Populares</h3>
                    </div>
                    <div className="space-y-4">
                        {genreStats.length > 0 ? (
                            genreStats.map((stat) => (
                                <div key={stat.genre} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="font-medium text-gray-700">{stat.genre}</span>
                                        <span className="text-gray-500">{stat.percentage}% ({stat.count})</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div 
                                            className="bg-purple-500 h-2 rounded-full transition-all duration-1000" 
                                            style={{ width: `${stat.percentage}%` }}
                                        ></div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-gray-500 py-4">Sem dados suficientes para estatísticas.</p>
                        )}
                    </div>
                </Card>

                <Card className="border-none shadow-md overflow-hidden">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white">
                        <h3 className="font-bold flex items-center gap-2">
                            <Trophy size={18} className="text-yellow-300" />
                            Top 5 Livros
                        </h3>
                    </div>
                    <div className="p-4 space-y-3">
                        {topBooks.map((book, idx) => (
                            <div key={idx} className="flex items-center justify-between border-b border-gray-50 last:border-0 pb-2">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold flex-shrink-0 ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {idx + 1}
                                    </span>
                                    <span className="text-sm text-gray-700 truncate">{book.title}</span>
                                </div>
                                <Badge variant="info">{book.count}</Badge>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>

            <div className="space-y-6">
                <Card className="border-none shadow-md overflow-hidden">
                    <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white">
                        <div className="flex items-center gap-2">
                            <Users size={18} />
                            <h4 className="font-bold">Leitura por Turma</h4>
                        </div>
                    </div>
                    <div className="p-4 space-y-4">
                        {classStats.map((item) => (
                            <div key={item.turma} className="space-y-1">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium text-gray-700">Turma {item.turma}</span>
                                    <span className="text-gray-500">{item.count}</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1.5">
                                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(item.count / (classStats[0]?.count || 1)) * 100}%` }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    </div>
);

const ReportsView: React.FC<{ addToast: any }> = ({ addToast }) => {
    const yearOptions = [{ value: '2025', label: '2025' }, { value: '2026', label: '2026' }, { value: '2027', label: '2027' }];
    const [selectedYear, setSelectedYear] = useState('2025');
    const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
    const [selectedClass, setSelectedClass] = useState('');
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [reportData, setReportData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchClasses = async () => {
            const { data } = await supabase.from('aluno').select('turma');
            if (data) setAvailableClasses(Array.from(new Set(data.map(d => d.turma).filter(Boolean))).sort() as string[]);
        };
        fetchClasses();
    }, []);

    useEffect(() => {
        const fetchReport = async () => {
            setLoading(true);
            const startDate = `${selectedYear}-${selectedMonth}-01`;
            const nextMonth = parseInt(selectedMonth) === 12 ? 1 : parseInt(selectedMonth) + 1;
            const nextYear = parseInt(selectedMonth) === 12 ? parseInt(selectedYear) + 1 : parseInt(selectedYear);
            const nextMonthStart = `${nextYear}-${nextMonth.toString().padStart(2, '0')}-01`;

            try {
                let query = supabase
                    .from('emprestimo')
                    .select('*, livros(titulo), aluno!inner(nome, turma)') 
                    .gte('data_emprestimo', startDate)
                    .lt('data_emprestimo', nextMonthStart)
                    .order('data_emprestimo', { ascending: false });
                
                if (selectedClass) query = query.eq('aluno.turma', selectedClass);
                
                const { data } = await query;
                if (data) setReportData(data);
            } catch (e) { console.error(e); } finally { setLoading(false); }
        };
        fetchReport();
    }, [selectedYear, selectedMonth, selectedClass]);

    const generatePDF = async () => {
        const doc = new jsPDF();
        const logoUrl = "https://snbzmggzcnvpymabssmg.supabase.co/storage/v1/object/public/Logo/logo%20biblioteca.png";
        
        doc.setFillColor(255, 255, 255); 
        doc.rect(0, 0, 210, 40, 'F');
        
        try {
            const imgData = await getDataUrl(logoUrl);
            if (imgData) doc.addImage(imgData, 'PNG', 14, 5, 30, 30);
        } catch (e) { console.warn("Failed to load logo for PDF"); }
        
        doc.setTextColor(30, 41, 59);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("Biblioteca Asas do Saber", 105, 20, { align: 'center' });
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(71, 85, 105);
        doc.text("Relatório de Empréstimos", 105, 30, { align: 'center' });

        doc.setTextColor(50, 50, 50);
        doc.setFontSize(10);
        doc.text(`Período: ${selectedMonth}/${selectedYear}`, 14, 50);
        doc.text(`Turma: ${selectedClass ? selectedClass : 'Todas'}`, 14, 55);
        doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 160, 50);

        const tableData = reportData.map(row => [
            new Date(row.data_emprestimo).toLocaleDateString('pt-BR'),
            row.aluno?.nome,
            row.aluno?.turma,
            row.livros?.titulo,
            row.status.toUpperCase()
        ]);

        autoTable(doc, {
            head: [['Data', 'Aluno', 'Turma', 'Livro', 'Status']],
            body: tableData,
            startY: 60,
            headStyles: { fillColor: [79, 70, 229] },
            alternateRowStyles: { fillColor: [245, 247, 255] },
            theme: 'grid'
        });

        const pageCount = doc.internal.pages.length - 1;
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("© 3R25 - Sistema de Biblioteca", 105, 290, { align: "center" });

        doc.save(`relatorio_${selectedYear}_${selectedMonth}.pdf`);
        addToast('Relatório PDF baixado!', 'success');
    };

    const handlePrint = () => {
        window.print();
    };

    // Helper para as cores do relatório
    const getStatusInfo = (item: any) => {
        const isOverdue = item.status === 'aprovado' && !item.data_devolucao_real && new Date(item.devolutiva) < new Date();
        
        if (isOverdue) return { label: 'ATRASADO', variant: 'danger' as const };
        
        switch (item.status) {
            case 'aprovado': return { label: 'LENDO', variant: 'success' as const }; // Verde para ativo
            case 'concluido': return { label: 'DEVOLVIDO', variant: 'info' as const }; // Azul para histórico
            case 'rejeitado': return { label: 'REJEITADO', variant: 'danger' as const }; // Vermelho
            case 'solicitado': return { label: 'PENDENTE', variant: 'warning' as const }; // Amarelo
            default: return { label: item.status.toUpperCase(), variant: 'default' as const };
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl shadow-sm border items-end print:hidden">
                <Select label="Ano" options={yearOptions} value={selectedYear} onChange={e => setSelectedYear(e.target.value)} />
                <Select label="Mês" options={[
                    {value:'01',label:'Janeiro'},{value:'02',label:'Fevereiro'},{value:'03',label:'Março'},{value:'04',label:'Abril'},
                    {value:'05',label:'Maio'},{value:'06',label:'Junho'},{value:'07',label:'Julho'},{value:'08',label:'Agosto'},
                    {value:'09',label:'Setembro'},{value:'10',label:'Outubro'},{value:'11',label:'Novembro'},{value:'12',label:'Dezembro'}
                ]} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
                <Select label="Turma" options={[{ value: '', label: 'Todas' }, ...availableClasses.map(c => ({ value: c, label: c }))]} value={selectedClass} onChange={e => setSelectedClass(e.target.value)} />
                
                <div className="flex gap-2">
                    <Button onClick={generatePDF} className="bg-red-600 hover:bg-red-700 text-white">
                        <Download className="mr-2" size={16}/> Salvar PDF
                    </Button>
                    <Button onClick={handlePrint}>
                        <Printer className="mr-2" size={16}/> Imprimir
                    </Button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border overflow-hidden print:border-none print:shadow-none">
                <div className="hidden print:block mb-4">
                     <div className="bg-white text-gray-900 p-8 text-center print-color-adjust-exact border-b-2 border-indigo-600">
                         <div className="flex items-center justify-center gap-4 mb-2">
                            <img src="https://snbzmggzcnvpymabssmg.supabase.co/storage/v1/object/public/Logo/logo%20biblioteca.png" className="h-20 w-auto" />
                            <h1 className="text-3xl font-bold text-gray-900">Biblioteca Asas do Saber</h1>
                         </div>
                         <p className="text-gray-600 text-lg">Relatório de Empréstimos</p>
                     </div>
                     <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between text-sm text-gray-600">
                         <p>Período: {selectedMonth}/{selectedYear}</p>
                         <p>Turma: {selectedClass ? selectedClass : 'Todas'}</p>
                         <p>Gerado em: {new Date().toLocaleDateString()}</p>
                     </div>
                </div>

                <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50 print:bg-white print:border-b-2 print:border-gray-300">
                        <tr><th>Data</th><th>Aluno</th><th>Turma</th><th>Livro</th><th className="text-right">Status</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? <tr><td colSpan={5} className="p-4 text-center">Carregando...</td></tr> : 
                         reportData.length === 0 ? <tr><td colSpan={5} className="p-4 text-center">Sem dados.</td></tr> :
                         reportData.map((item) => {
                            const statusInfo = getStatusInfo(item);
                            return (
                                <tr key={item.id} className="hover:bg-gray-50 print:hover:bg-white">
                                    <td className="px-6 py-3">{new Date(item.data_emprestimo).toLocaleDateString()}</td>
                                    <td className="px-6 py-3">{item.aluno?.nome}</td>
                                    <td className="px-6 py-3">{item.aluno?.turma}</td>
                                    <td className="px-6 py-3">{item.livros?.titulo}</td>
                                    <td className="px-6 py-3 text-right">
                                        <Badge variant={statusInfo.variant}>
                                            {statusInfo.label}
                                        </Badge>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                
                <div className="hidden print:block mt-8 text-center text-xs text-gray-400">
                    <p>© 3R25. Todos os direitos reservados. Gerado em {new Date().toLocaleDateString()}.</p>
                </div>
            </div>
        </div>
    );
};

// --- Main Component ---

export const LibrarianDashboard: React.FC<{ initialTab?: string }> = ({ initialTab = 'overview' }) => {
    const [tab, setTab] = useState(initialTab);
    const { addToast } = useToast();
    const [filterOverdueUsers, setFilterOverdueUsers] = useState(false);
    const [dashboardStats, setDashboardStats] = useState({
        totalBooks: 0,
        activeLoans: 0,
        overdueLoans: 0,
        totalUsers: 0
    });
    
    // Stats for Charts
    const [genreStats, setGenreStats] = useState<{genre: string, count: number, percentage: number}[]>([]);
    const [topBooks, setTopBooks] = useState<{title: string, count: number}[]>([]);
    const [classStats, setClassStats] = useState<{turma: string, count: number}[]>([]);

    useEffect(() => {
        setTab(initialTab);
        if (initialTab !== 'users') {
            setFilterOverdueUsers(false);
        }
    }, [initialTab]);

    useEffect(() => {
        if (tab === 'overview') {
            fetchDashboardData();
        }
    }, [tab]);

    const fetchDashboardData = async () => {
        try {
            const { count: booksCount } = await supabase.from('livros').select('*', { count: 'exact', head: true });
            const { count: usersCount } = await supabase.from('aluno').select('*', { count: 'exact', head: true });
            const { data: loans } = await supabase.from('emprestimo').select('id, id_livro, status, devolutiva, data_devolucao_real, data_emprestimo, aluno(turma), livros(titulo, genero)');
            
            let active = 0;
            let overdue = 0;
            const bookCounts: Record<string, number> = {};
            const classCounts: Record<string, number> = {};
            const genreCounts: Record<string, number> = {};

            if (loans) {
                const now = new Date();
                loans.forEach((l: any) => {
                    if (l.status === 'aprovado' && !l.data_devolucao_real) {
                        active++;
                        if (new Date(l.devolutiva) < now) overdue++;
                    }
                    const bookTitle = l.livros?.titulo;
                    if (bookTitle) bookCounts[bookTitle] = (bookCounts[bookTitle] || 0) + 1;
                    const turma = l.aluno?.turma;
                    if (turma) classCounts[turma] = (classCounts[turma] || 0) + 1;
                    const genre = l.livros?.genero;
                    if (genre) genreCounts[genre] = (genreCounts[genre] || 0) + 1;
                });
            }

            setDashboardStats({
                totalBooks: booksCount || 0,
                totalUsers: usersCount || 0,
                activeLoans: active,
                overdueLoans: overdue
            });

            setTopBooks(Object.entries(bookCounts).map(([title, count]) => ({ title, count })).sort((a, b) => b.count - a.count).slice(0, 5));
            setClassStats(Object.entries(classCounts).map(([turma, count]) => ({ turma, count })).sort((a, b) => b.count - a.count).slice(0, 5));
            const totalLoans = loans?.length || 1;
            setGenreStats(Object.entries(genreCounts)
                .map(([genre, count]) => ({ genre, count, percentage: Math.round((count / totalLoans) * 100) }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5));

        } catch (e) { console.error(e); }
    };

    const handleOverdueClick = () => {
        setFilterOverdueUsers(true);
        setTab('users'); 
    };

    const getTabTitle = (t: string) => {
        const titles: Record<string, string> = {
            'overview': 'Visão Geral',
            'users': 'Gerenciar Usuários',
            'loans': 'Gestão de Empréstimos',
            'books': 'Gerenciar Acervo',
            'comments': 'Moderação de Comentários',
            'reports': 'Relatórios'
        };
        return titles[t] || t;
    };

    // Tabs that already have their own headers inside the component
    const tabsWithOwnHeader = ['books', 'users', 'comments'];

    return (
        <div className="space-y-6">
            {!tabsWithOwnHeader.includes(tab) && (
                <h1 className="text-2xl font-bold text-gray-800 capitalize print:hidden">
                    {getTabTitle(tab)}
                </h1>
            )}
            
            <style>{`
                @media print {
                    aside, header, h1, button, input, select, .print\\:hidden { display: none !important; }
                    body { background: white; }
                    main { padding: 0; overflow: visible; height: auto; }
                    .print\\:block { display: block !important; }
                }
            `}</style>

            <div>
                {tab === 'overview' && <Overview stats={dashboardStats} genreStats={genreStats} topBooks={topBooks} classStats={classStats} setTab={setTab} onOverdueClick={handleOverdueClick} />}
                {tab === 'books' && <BookManagement />}
                {tab === 'users' && <UserManagement showOverdueOnly={filterOverdueUsers} />}
                {tab === 'loans' && <LoanManagement />}
                {tab === 'comments' && <CommentsManagement />}
                {tab === 'reports' && <ReportsView addToast={addToast} />}
            </div>
        </div>
    );
};
