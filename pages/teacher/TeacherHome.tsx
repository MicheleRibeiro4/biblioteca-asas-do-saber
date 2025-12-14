
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { Card, StatCard, Badge, Button, Input } from '../../components/ui/Layouts';
import { Users, BookOpen, Clock, Printer, Trophy, TrendingUp, AlertCircle, Filter, ChevronDown, Check, Download, Search, PieChart, BarChart3, GraduationCap } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
        img.onerror = () => { resolve(''); };
    });
};

export const TeacherHome: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [classRanking, setClassRanking] = useState<any[]>([]);
  const [topStudents, setTopStudents] = useState<any[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [genreStats, setGenreStats] = useState<{genre: string, count: number, percentage: number}[]>([]);
  
  // UI States
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const filterRef = useRef<HTMLDivElement>(null);

  const [stats, setStats] = useState({
    totalStudents: 0,
    activeCount: 0,
    overdueCount: 0,
    monthlyReads: 0
  });

  useEffect(() => {
    const fetchClasses = async () => {
        try {
            const { data } = await supabase.from('aluno').select('turma');
            if (data) {
                const unique = Array.from(new Set(data.map(d => d.turma).filter(Boolean))).sort() as string[];
                setAvailableClasses(unique);
                if (user?.turma && unique.includes(user.turma)) setSelectedClasses([user.turma]);
                else setSelectedClasses(unique); 
            }
        } catch (e) { console.error("Error fetching classes", e); }
    };
    fetchClasses();
  }, [user]);

  useEffect(() => {
    if (selectedClasses.length > 0) loadDashboardData();
    else { 
        setActiveLoans([]); 
        setClassRanking([]); 
        setTopStudents([]); 
        setGenreStats([]);
        setStats({ totalStudents: 0, activeCount: 0, overdueCount: 0, monthlyReads: 0 }); 
        setLoading(false); 
    }
  }, [selectedClasses]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) { if (filterRef.current && !filterRef.current.contains(event.target as Node)) setIsFilterOpen(false); }
    document.addEventListener("mousedown", handleClickOutside);
    return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, [filterRef]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Active Loans with Book Details
      const { data: activeData, error: activeError } = await supabase
        .from('emprestimo')
        .select('*, livros(titulo, genero, capa_url), aluno!inner(nome, matricula, turma)')
        .in('aluno.turma', selectedClasses)
        .eq('status', 'aprovado')
        .is('data_devolucao_real', null)
        .order('devolutiva', { ascending: true });

      if (activeError) throw activeError;
      setActiveLoans(activeData || []);

      // 2. Class Ranking (All time/Month)
      const startOfMonth = new Date(); startOfMonth.setDate(1); startOfMonth.setHours(0,0,0,0);
      const { data: allLoans } = await supabase.from('emprestimo').select('id, aluno!inner(turma)').gte('data_emprestimo', startOfMonth.toISOString());
      
      if (allLoans) {
        const counts: Record<string, number> = {};
        allLoans.forEach((l: any) => { const t = l.aluno?.turma; if (t) counts[t] = (counts[t] || 0) + 1; });
        setClassRanking(Object.entries(counts).map(([turma, count]) => ({ turma, count })).sort((a, b) => b.count - a.count).slice(0, 5));
      }

      // 3. Top Students in Selected Classes
      const { data: historyData } = await supabase.from('emprestimo').select('id, aluno!inner(nome, matricula, turma)').in('aluno.turma', selectedClasses); 
      if (historyData) {
          const studentCounts: Record<string, number> = {};
          historyData.forEach((l: any) => { const name = l.aluno.nome; studentCounts[name] = (studentCounts[name] || 0) + 1; });
          setTopStudents(Object.entries(studentCounts).map(([nome, count]) => ({ nome, count })).sort((a, b) => b.count - a.count).slice(0, 5));
      }

      // 4. Genre Stats (Based on Active Loans)
      const genreCounts: Record<string, number> = {};
      activeData?.forEach((l: any) => {
          const g = l.livros?.genero || 'Outros';
          genreCounts[g] = (genreCounts[g] || 0) + 1;
      });
      const totalActive = activeData?.length || 1;
      setGenreStats(Object.entries(genreCounts)
        .map(([genre, count]) => ({ genre, count, percentage: Math.round((count / totalActive) * 100) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5));

      // 5. General Stats
      const now = new Date();
      const overdue = activeData?.filter(l => new Date(l.devolutiva) < now).length || 0;
      const { count: studentCount } = await supabase.from('aluno').select('*', { count: 'exact', head: true }).in('turma', selectedClasses);
      
      setStats({ 
        totalStudents: studentCount || 0, 
        activeCount: activeData?.length || 0, 
        overdueCount: overdue, 
        monthlyReads: historyData?.length || 0 
      });

    } catch (err: any) { 
        console.error(err); 
        addToast('Erro ao carregar dados: ' + err.message, 'error'); 
    } finally { 
        setLoading(false); 
    }
  };

  const toggleClass = (turma: string) => { setSelectedClasses(prev => prev.includes(turma) ? prev.filter(t => t !== turma) : [...prev, turma]); };
  const selectAllClasses = () => { setSelectedClasses(availableClasses); };
  const clearClasses = () => { setSelectedClasses([]); };
  const handlePrint = () => { window.print(); };

  const generatePDF = async () => {
      const doc = new jsPDF();
      const logoUrl = "https://snbzmggzcnvpymabssmg.supabase.co/storage/v1/object/public/Logo/logo%20biblioteca.png";
      doc.setFillColor(255, 255, 255); doc.rect(0, 0, 210, 40, 'F');
      try { const imgData = await getDataUrl(logoUrl); if (imgData) doc.addImage(imgData, 'PNG', 14, 5, 30, 30); } catch (e) { console.warn("Failed to load logo"); }
      doc.setTextColor(30, 41, 59); doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.text("Biblioteca Asas do Saber", 105, 20, { align: 'center' });
      doc.setFontSize(12); doc.setFont("helvetica", "normal"); doc.setTextColor(71, 85, 105); doc.text("Relatório de Leitura Escolar", 105, 30, { align: 'center' });
      doc.setTextColor(50, 50, 50); doc.setFontSize(10); doc.text(`Professor: ${user?.nome || 'Docente'}`, 14, 50); doc.text(`Turmas: ${selectedClasses.join(', ') || 'Todas'}`, 14, 55); doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 160, 50);
      const tableData = activeLoans.map(loan => { const isLate = new Date(loan.devolutiva) < new Date(); return [loan.aluno.nome, loan.aluno.turma, loan.livros?.titulo, new Date(loan.devolutiva).toLocaleDateString('pt-BR'), isLate ? 'ATRASADO' : 'NO PRAZO']; });
      autoTable(doc, { head: [['Aluno', 'Turma', 'Livro', 'Devolução', 'Situação']], body: tableData, startY: 65, headStyles: { fillColor: [79, 70, 229] }, alternateRowStyles: { fillColor: [245, 247, 255] }, theme: 'grid' });
      doc.setFontSize(8); doc.setTextColor(150); doc.text("© 3R25 - Sistema de Biblioteca", 105, 290, { align: "center" });
      doc.save(`relatorio_turma_${new Date().toISOString().slice(0,10)}.pdf`); addToast('Relatório PDF salvo!', 'success');
  };

  // Filter Active Loans based on Search
  const filteredActiveLoans = activeLoans.filter(l => 
    l.aluno?.nome?.toLowerCase().includes(tableSearchTerm.toLowerCase()) || 
    l.livros?.titulo?.toLowerCase().includes(tableSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
       
       {/* Welcome Banner */}
       <div className="bg-gradient-to-r from-indigo-700 to-purple-800 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden print:hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-12 translate-x-12"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                        <GraduationCap className="text-yellow-300" size={32} />
                        Olá, Professor(a) {user?.nome?.split(' ')[0]}!
                    </h1>
                    <p className="text-indigo-100 max-w-xl">
                        Acompanhe o progresso de leitura das suas turmas, identifique pendências e incentive novos leitores.
                    </p>
                </div>
                
                {/* Filters & Actions in Banner */}
                <div className="flex flex-wrap gap-2 bg-white/10 p-2 rounded-xl border border-white/20 backdrop-blur-sm">
                     <div className="relative" ref={filterRef}>
                        <Button onClick={() => setIsFilterOpen(!isFilterOpen)} className="bg-white/90 text-indigo-900 hover:bg-white border-none flex items-center gap-2 min-w-[180px] justify-between h-10">
                            <span className="flex items-center gap-2 text-sm"><Filter size={14} />{selectedClasses.length === 0 ? 'Selecione' : selectedClasses.length === availableClasses.length ? 'Todas' : `${selectedClasses.length} Turma(s)`}</span>
                            <ChevronDown size={14} />
                        </Button>
                        {isFilterOpen && (
                            <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-2 text-gray-800 animate-in zoom-in-95 duration-200">
                                <div className="flex justify-between px-2 py-1 mb-2 border-b border-gray-50">
                                    <button onClick={selectAllClasses} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800">Todas</button>
                                    <button onClick={clearClasses} className="text-xs font-semibold text-gray-500 hover:text-gray-700">Limpar</button>
                                </div>
                                <div className="max-h-60 overflow-y-auto space-y-1">
                                    {availableClasses.map(turma => (
                                        <label key={turma} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${selectedClasses.includes(turma) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 bg-white'}`}>
                                                {selectedClasses.includes(turma) && <Check size={10} className="text-white" />}
                                            </div>
                                            <input type="checkbox" className="hidden" checked={selectedClasses.includes(turma)} onChange={() => toggleClass(turma)}/>
                                            <span className={`text-sm ${selectedClasses.includes(turma) ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>{turma}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <Button onClick={generatePDF} className="bg-indigo-600 hover:bg-indigo-500 text-white h-10 w-10 p-0 flex items-center justify-center" title="Baixar PDF"><Download size={18} /></Button>
                    <Button onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-500 text-white h-10 w-10 p-0 flex items-center justify-center" title="Imprimir"><Printer size={18} /></Button>
                </div>
            </div>
       </div>

       {/* Print Header */}
       <div className="hidden print:block mb-8 text-center border-b pb-4">
           <div className="flex justify-center items-center gap-4 mb-4"><img src="https://snbzmggzcnvpymabssmg.supabase.co/storage/v1/object/public/Logo/logo%20biblioteca.png" className="h-16 w-auto" /><h1 className="text-2xl font-bold text-gray-900">Biblioteca Asas do Saber</h1></div>
           <h2 className="text-xl font-semibold text-gray-800">Relatório de Leitura Escolar</h2><p className="text-gray-500 mt-1">Turmas: {selectedClasses.join(', ') || 'Todas'}</p><p className="text-gray-400 text-sm">Gerado em {new Date().toLocaleDateString()}</p>
       </div>

       {/* KPIs */}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
         <StatCard title="Alunos Totais" value={stats.totalStudents} icon={<Users size={24} />} color="indigo" />
         <StatCard title="Lendo Agora" value={stats.activeCount} icon={<BookOpen size={24} />} color="emerald" />
         <StatCard title="Pendências" value={stats.overdueCount} icon={<Clock size={24} />} color="rose" trend={stats.overdueCount > 0 ? "Atenção Necessária" : "Em dia"} trendUp={stats.overdueCount === 0} />
         <StatCard title="Leituras no Mês" value={stats.monthlyReads} icon={<TrendingUp size={24} />} color="amber" />
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Active Loans Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none">
                <div className="p-5 border-b border-gray-100 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4 print:bg-white print:px-0">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><BookOpen size={20} /></div>
                        <div>
                            <h3 className="font-bold text-gray-800">Leituras em Andamento</h3>
                            <p className="text-xs text-gray-500">Alunos com empréstimos ativos</p>
                        </div>
                    </div>
                    <div className="relative w-full sm:w-64 print:hidden">
                        <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                        <Input 
                            placeholder="Buscar aluno ou livro..." 
                            className="pl-9 py-2 text-sm bg-white" 
                            value={tableSearchTerm}
                            onChange={e => setTableSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                        <thead className="bg-gray-50/50 print:bg-white"><tr><th className="px-6 py-3 text-left font-semibold text-gray-600">Aluno</th><th className="px-6 py-3 text-left font-semibold text-gray-600">Turma</th><th className="px-6 py-3 text-left font-semibold text-gray-600">Livro</th><th className="px-6 py-3 text-left font-semibold text-gray-600">Devolução</th><th className="px-6 py-3 text-right font-semibold text-gray-600">Situação</th></tr></thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {loading ? <tr><td colSpan={5} className="p-12 text-center text-gray-500">Carregando dados...</td></tr> : 
                             filteredActiveLoans.length === 0 ? <tr><td colSpan={5} className="p-12 text-center text-gray-500 flex flex-col items-center"><Check className="w-8 h-8 text-gray-300 mb-2"/>Nenhum empréstimo ativo encontrado.</td></tr> : 
                             filteredActiveLoans.map((loan) => {
                                    const isLate = new Date(loan.devolutiva) < new Date();
                                    return (
                                        <tr key={loan.id} className="hover:bg-gray-50/50 transition-colors print:hover:bg-white">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{loan.aluno.nome}</div>
                                                <div className="text-xs text-gray-400 font-mono">{loan.aluno.matricula}</div>
                                            </td>
                                            <td className="px-6 py-4"><Badge variant="default">{loan.aluno.turma}</Badge></td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-10 bg-gray-200 rounded overflow-hidden flex-shrink-0 border border-gray-200">
                                                        {loan.livros?.capa_url ? <img src={loan.livros.capa_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400 font-bold">{loan.livros?.titulo[0]}</div>}
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-900 font-medium line-clamp-1">{loan.livros?.titulo}</div>
                                                        <div className="text-xs text-indigo-500">{loan.livros?.genero}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 font-medium">{new Date(loan.devolutiva).toLocaleDateString('pt-BR')}</td>
                                            <td className="px-6 py-4 text-right"><Badge variant={isLate ? 'danger' : 'success'}>{isLate ? 'ATRASADO' : 'NO PRAZO'}</Badge></td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:hidden">
                <Card className="h-full border-none shadow-md">
                    <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
                        <BarChart3 className="text-indigo-600" size={20} />
                        <h3 className="font-bold text-gray-800">Ranking das Turmas</h3>
                    </div>
                    <div className="space-y-4">
                         {classRanking.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">Sem dados.</p> : classRanking.map((item, index) => {
                             const max = classRanking[0].count;
                             const percent = (item.count / max) * 100;
                             return (
                                <div key={item.turma} className="space-y-1">
                                    <div className="flex justify-between text-sm font-medium">
                                        <span className={index === 0 ? "text-indigo-600" : "text-gray-700"}>{index + 1}º Turma {item.turma}</span>
                                        <span className="text-gray-500">{item.count} livros</span>
                                    </div>
                                    <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div className={`h-2 rounded-full transition-all duration-1000 ${index === 0 ? 'bg-indigo-600' : 'bg-indigo-300'}`} style={{ width: `${percent}%` }}></div>
                                    </div>
                                </div>
                             )
                         })}
                    </div>
                </Card>

                <Card className="h-full border-none shadow-md">
                    <div className="flex items-center gap-2 mb-4 border-b border-gray-100 pb-3">
                        <PieChart className="text-purple-600" size={20} />
                        <h3 className="font-bold text-gray-800">Preferências das Turmas</h3>
                    </div>
                    <div className="space-y-3">
                         {genreStats.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">Sem empréstimos ativos.</p> : genreStats.map((stat) => (
                             <div key={stat.genre} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors">
                                 <div className="flex items-center gap-2">
                                     <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                     <span className="text-sm text-gray-700 font-medium">{stat.genre}</span>
                                 </div>
                                 <Badge variant="default">{stat.percentage}%</Badge>
                             </div>
                         ))}
                    </div>
                </Card>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
             <Card className="print:shadow-none print:border bg-gradient-to-b from-white to-gray-50 border-gray-200">
                <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                    <Trophy size={18} className="text-yellow-500" /> 
                    <div>
                        <h3 className="font-bold text-gray-800">Top Leitores</h3>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">Histórico Geral</p>
                    </div>
                </div>
                <div className="p-4">
                    {topStudents.length === 0 ? <p className="text-center text-gray-400 text-sm py-4">Sem dados suficientes.</p> : topStudents.map((student, index) => (
                        <div key={student.nome} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0 hover:bg-white hover:shadow-sm rounded-lg px-2 transition-all">
                            <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${index === 0 ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-200' : index === 1 ? 'bg-gray-100 text-gray-600' : index === 2 ? 'bg-orange-100 text-orange-700' : 'bg-white border border-gray-200 text-gray-400'}`}>
                                    {index + 1}
                                </div>
                                <span className="text-sm text-gray-700 font-medium truncate max-w-[120px]" title={student.nome}>{student.nome}</span>
                            </div>
                            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">{student.count}</span>
                        </div>
                    ))}
                </div>
            </Card>

             <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100 text-center print:hidden">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-indigo-600 mx-auto mb-3 shadow-sm">
                    <AlertCircle size={24} />
                </div>
                <h4 className="font-bold text-indigo-900 mb-1">Dica Pedagógica</h4>
                <p className="text-sm text-indigo-700">
                    Incentive os alunos com livros atrasados a renovarem ou devolverem para evitar bloqueios.
                </p>
             </div>
             
             <div className="hidden print:block text-center text-xs text-gray-400 mt-8"><p>Biblioteca Asas do Saber - Relatório Docente</p></div>
          </div>
       </div>
    </div>
  );
};
