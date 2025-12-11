
import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { Card, StatCard, Badge, Button } from '../../components/ui/Layouts';
import { Users, BookOpen, Clock, Printer, Trophy, TrendingUp, AlertCircle, Filter, ChevronDown, Check, Download } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper to handle image loading for PDF logic
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
            resolve('');
        };
    });
};

export const TeacherHome: React.FC = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [classRanking, setClassRanking] = useState<any[]>([]);
  const [topStudents, setTopStudents] = useState<any[]>([]);
  
  // Filter States
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Stats
  const [stats, setStats] = useState({
    totalStudents: 0,
    activeCount: 0,
    overdueCount: 0,
    monthlyReads: 0
  });

  // Fetch available classes on mount
  useEffect(() => {
    const fetchClasses = async () => {
        try {
            const { data } = await supabase.from('aluno').select('turma');
            if (data) {
                const unique = Array.from(new Set(data.map(d => d.turma).filter(Boolean))).sort() as string[];
                setAvailableClasses(unique);
                
                // Initialize selection: User's class if exists, otherwise all classes
                if (user?.turma && unique.includes(user.turma)) {
                    setSelectedClasses([user.turma]);
                } else {
                    setSelectedClasses(unique); 
                }
            }
        } catch (e) {
            console.error("Error fetching classes", e);
        }
    };
    fetchClasses();
  }, [user]);

  // Reload data when selection changes
  useEffect(() => {
    if (selectedClasses.length > 0) {
      loadDashboardData();
    } else {
        // Clear data if nothing selected
        setActiveLoans([]);
        setClassRanking([]);
        setTopStudents([]);
        setStats({ totalStudents: 0, activeCount: 0, overdueCount: 0, monthlyReads: 0 });
        setLoading(false);
    }
  }, [selectedClasses]);

  // Click outside to close filter
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [filterRef]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Load Active Loans for SELECTED Classes
      const { data: activeData, error: activeError } = await supabase
        .from('emprestimo')
        .select('*, livros(titulo, genero), aluno!inner(nome, matricula, turma)')
        .in('aluno.turma', selectedClasses)
        .eq('status', 'aprovado')
        .is('data_devolucao_real', null)
        .order('devolutiva', { ascending: true });

      if (activeError) throw activeError;
      setActiveLoans(activeData || []);

      // 2. Load School-Wide Class Ranking (Global context)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0,0,0,0);

      const { data: allLoans } = await supabase
        .from('emprestimo')
        .select('id, aluno!inner(turma)')
        .gte('data_emprestimo', startOfMonth.toISOString());

      if (allLoans) {
        const counts: Record<string, number> = {};
        allLoans.forEach((l: any) => {
            const t = l.aluno?.turma;
            if (t) counts[t] = (counts[t] || 0) + 1;
        });
        
        const sortedClasses = Object.entries(counts)
            .map(([turma, count]) => ({ turma, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Top 5
        
        setClassRanking(sortedClasses);
      }

      // 3. Top Readers in SELECTED Classes
      const { data: historyData } = await supabase
        .from('emprestimo')
        .select('id, aluno!inner(nome, matricula, turma)')
        .in('aluno.turma', selectedClasses); 

      if (historyData) {
          const studentCounts: Record<string, number> = {};
          historyData.forEach((l: any) => {
              const name = l.aluno.nome;
              studentCounts[name] = (studentCounts[name] || 0) + 1;
          });

          const sortedStudents = Object.entries(studentCounts)
            .map(([nome, count]) => ({ nome, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
          
          setTopStudents(sortedStudents);
      }

      // 4. Calculate Stats
      const now = new Date();
      const overdue = activeData?.filter(l => new Date(l.devolutiva) < now).length || 0;
      
      const { count: studentCount } = await supabase
        .from('aluno')
        .select('*', { count: 'exact', head: true })
        .in('turma', selectedClasses);

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

  const toggleClass = (turma: string) => {
      setSelectedClasses(prev => 
          prev.includes(turma) 
            ? prev.filter(t => t !== turma)
            : [...prev, turma]
      );
  };

  const selectAllClasses = () => {
      setSelectedClasses(availableClasses);
  };

  const clearClasses = () => {
      setSelectedClasses([]);
  };

  const handlePrint = () => {
    window.print();
  };

  const generatePDF = async () => {
      const doc = new jsPDF();
      const logoUrl = "https://snbzmggzcnvpymabssmg.supabase.co/storage/v1/object/public/Logo/logo%20biblioteca.png";
      
      // --- HEADER WHITE BACKGROUND ---
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, 210, 40, 'F');
      
      // Add Logo
      try {
          const imgData = await getDataUrl(logoUrl);
          if (imgData) {
              doc.addImage(imgData, 'PNG', 14, 5, 30, 30);
          }
      } catch (e) { console.warn("Failed to load logo for PDF"); }
      
      // Text Dark
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("Biblioteca Asas do Saber", 105, 20, { align: 'center' });
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(71, 85, 105);
      doc.text("Relatório de Leitura Escolar", 105, 30, { align: 'center' });

      // --- METADATA ---
      doc.setTextColor(50, 50, 50);
      doc.setFontSize(10);
      doc.text(`Professor: ${user?.nome || 'Docente'}`, 14, 50);
      doc.text(`Turmas: ${selectedClasses.join(', ') || 'Todas'}`, 14, 55);
      doc.text(`Gerado em: ${new Date().toLocaleDateString()}`, 160, 50);

      // --- TABLE ---
      const tableData = activeLoans.map(loan => {
          const isLate = new Date(loan.devolutiva) < new Date();
          return [
            loan.aluno.nome,
            loan.aluno.turma,
            loan.livros?.titulo,
            new Date(loan.devolutiva).toLocaleDateString('pt-BR'),
            isLate ? 'ATRASADO' : 'NO PRAZO'
          ];
      });

      autoTable(doc, {
          head: [['Aluno', 'Turma', 'Livro', 'Devolução', 'Situação']],
          body: tableData,
          startY: 65,
          headStyles: { fillColor: [79, 70, 229] },
          alternateRowStyles: { fillColor: [245, 247, 255] },
          theme: 'grid'
      });

      // Footer
      const pageCount = doc.internal.pages.length - 1;
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text("© 3R25 - Sistema de Biblioteca", 105, 290, { align: "center" });

      doc.save(`relatorio_turma_${new Date().toISOString().slice(0,10)}.pdf`);
      addToast('Relatório PDF salvo!', 'success');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
       {/* Header */}
       <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 print:hidden">
         <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <Users className="text-indigo-600" />
                Painel do Professor
            </h1>
            <p className="text-gray-500">Acompanhamento de leitura e atividades das turmas.</p>
         </div>
         <div className="flex flex-wrap gap-3">
            {/* Class Filter Dropdown */}
            <div className="relative" ref={filterRef}>
                <Button 
                    onClick={() => setIsFilterOpen(!isFilterOpen)} 
                    variant="outline" 
                    className="flex items-center gap-2 bg-white border-gray-300 min-w-[200px] justify-between"
                >
                    <span className="flex items-center gap-2">
                        <Filter size={16} />
                        {selectedClasses.length === 0 
                            ? 'Selecione Turmas' 
                            : selectedClasses.length === availableClasses.length 
                                ? 'Todas as Turmas' 
                                : `${selectedClasses.length} Turma(s)`}
                    </span>
                    <ChevronDown size={14} />
                </Button>

                {isFilterOpen && (
                    <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-2 animate-in zoom-in-95 duration-200">
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
                                    <input 
                                        type="checkbox" 
                                        className="hidden" 
                                        checked={selectedClasses.includes(turma)} 
                                        onChange={() => toggleClass(turma)}
                                    />
                                    <span className={`text-sm ${selectedClasses.includes(turma) ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>{turma}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <Button onClick={loadDashboardData} variant="outline" title="Atualizar dados">
                Atualizar
            </Button>
            <Button onClick={generatePDF} className="bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 shadow-sm">
                <Download size={18} /> Salvar PDF
            </Button>
            <Button onClick={handlePrint} className="flex items-center gap-2 shadow-sm">
                <Printer size={18} /> Imprimir
            </Button>
         </div>
       </div>

       {/* Print Header - Updated to White Background */}
       <div className="hidden print:block mb-8 text-center border-b pb-4">
           <div className="flex justify-center items-center gap-4 mb-4">
                <img src="https://snbzmggzcnvpymabssmg.supabase.co/storage/v1/object/public/Logo/logo%20biblioteca.png" className="h-16 w-auto" />
                <h1 className="text-2xl font-bold text-gray-900">Biblioteca Asas do Saber</h1>
           </div>
           <h2 className="text-xl font-semibold text-gray-800">Relatório de Leitura Escolar</h2>
           <p className="text-gray-500 mt-1">Turmas: {selectedClasses.join(', ') || 'Todas'}</p>
           <p className="text-gray-400 text-sm">Gerado em {new Date().toLocaleDateString()}</p>
       </div>
       
       {/* Stats Row */}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
         <StatCard 
            title="Total de Alunos (Filtro)" 
            value={stats.totalStudents} 
            icon={<Users size={24} />} 
            color="indigo" 
         />
         <StatCard 
            title="Lendo Agora" 
            value={stats.activeCount} 
            icon={<BookOpen size={24} />} 
            color="emerald" 
         />
         <StatCard 
            title="Pendências" 
            value={stats.overdueCount} 
            icon={<Clock size={24} />} 
            color="rose"
            trend={stats.overdueCount > 0 ? "Atenção Necessária" : "Em dia"}
            trendUp={stats.overdueCount === 0}
         />
         <StatCard 
            title="Leituras Totais" 
            value={stats.monthlyReads} 
            icon={<TrendingUp size={24} />} 
            color="amber" 
         />
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Content: Active Loans Detail */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden print:border-none print:shadow-none">
                <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center print:bg-white print:px-0">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <BookOpen size={18} className="text-indigo-600" />
                        Alunos com Livros (Empréstimos Ativos)
                    </h3>
                    <Badge variant="info">{activeLoans.length} registros</Badge>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                        <thead className="bg-gray-50 print:bg-white">
                            <tr>
                                <th className="px-6 py-3 text-left font-semibold text-gray-600">Aluno</th>
                                <th className="px-6 py-3 text-left font-semibold text-gray-600">Turma</th>
                                <th className="px-6 py-3 text-left font-semibold text-gray-600">Livro</th>
                                <th className="px-6 py-3 text-left font-semibold text-gray-600">Devolução</th>
                                <th className="px-6 py-3 text-right font-semibold text-gray-600">Situação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Carregando dados...</td></tr>
                            ) : activeLoans.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Nenhum aluno está com livro pendente nas turmas selecionadas.</td></tr>
                            ) : (
                                activeLoans.map((loan) => {
                                    const isLate = new Date(loan.devolutiva) < new Date();
                                    return (
                                        <tr key={loan.id} className="hover:bg-gray-50/50 print:hover:bg-white">
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                {loan.aluno.nome}
                                                <span className="block text-xs text-gray-400 font-normal">{loan.aluno.matricula}</span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                <Badge variant="default">{loan.aluno.turma}</Badge>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {loan.livros?.titulo}
                                                <span className="block text-xs text-indigo-400">{loan.livros?.genero}</span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {new Date(loan.devolutiva).toLocaleDateString('pt-BR')}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Badge variant={isLate ? 'danger' : 'success'}>
                                                    {isLate ? 'ATRASADO' : 'NO PRAZO'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
          </div>

          <div className="space-y-6">
             <Card className="overflow-hidden border-indigo-100 print:shadow-none print:border">
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 text-white"><h3 className="font-bold flex items-center gap-2"><Trophy size={18} className="text-yellow-300" /> Ranking das Turmas</h3><p className="text-indigo-100 text-xs mt-1">Quem leu mais este mês?</p></div>
                <div className="p-4">
                    {classRanking.map((item, index) => (
                        <div key={item.turma} className={`flex items-center justify-between p-3 rounded-lg mb-2 ${selectedClasses.includes(item.turma) ? 'bg-indigo-50 border border-indigo-100' : ''}`}>
                            <div className="flex items-center gap-3"><span className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>{index + 1}</span><span className={`font-medium ${selectedClasses.includes(item.turma) ? 'text-indigo-700' : 'text-gray-700'}`}>Turma {item.turma}</span></div>
                            <span className="text-sm font-bold text-gray-900">{item.count} <span className="text-xs font-normal text-gray-400">livros</span></span>
                        </div>
                    ))}
                </div>
             </Card>
             <Card className="print:shadow-none print:border">
                <div className="p-4 border-b border-gray-100"><h3 className="font-bold text-gray-800 flex items-center gap-2"><TrendingUp size={18} className="text-emerald-500" /> Top Leitores (Seleção)</h3></div>
                <div className="p-4">
                    {topStudents.length === 0 ? <p className="text-center text-gray-400 text-sm py-4">Sem dados de leitura para a seleção.</p> : topStudents.map((student, index) => (
                        <div key={student.nome} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                            <div className="flex items-center gap-2">{index === 0 && <Trophy size={14} className="text-yellow-500" />}<span className="text-sm text-gray-700 truncate max-w-[150px]">{student.nome}</span></div>
                            <Badge variant="info">{student.count} livros</Badge>
                        </div>
                    ))}
                </div>
             </Card>
             <div className="hidden print:block text-center text-xs text-gray-400 mt-8"><p>Biblioteca Asas do Saber - Relatório Docente</p></div>
          </div>
       </div>
    </div>
  );
};
