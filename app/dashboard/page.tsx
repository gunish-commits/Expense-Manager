// app/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowUpRight, ArrowDownRight, Users } from 'lucide-react';
import { isGuestMode, getGuestUser, supabase } from '@/lib/supabase/client';
import { getGroups, getGroupMembers } from '@/lib/supabase/groups';
import { getBatchExpenses, getBatchSettlements } from '@/lib/supabase/expenses';
import { getPersonalExpenses } from '@/lib/supabase/personalExpenses';
import { getBorrowRecords } from '@/lib/supabase/borrow';
import { formatCurrency } from '@/lib/utils/format';
import { useToast } from '@/components/ui/Toast';
import { SkeletonDashboard } from '@/components/ui/Skeleton';
import { Group, Expense, PersonalExpense, Profile } from '@/types';

const CategorySpendChart = dynamic(
  () => import('@/components/dashboard/CategorySpendChart'),
  { 
    ssr: false, 
    loading: () => (
      <div className="bg-surface border border-border p-6 rounded-xl h-48 flex items-center justify-center text-[13px] text-text-secondary animate-pulse">
        Loading spend charts...
      </div>
    )
  }
);

export default function DashboardSummary() {
  const router = useRouter();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Data states
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupBalances, setGroupBalances] = useState<Record<string, number>>({});
  const [groupMembersMap, setGroupMembersMap] = useState<Record<string, Profile[]>>({});
  const [totalSpent, setTotalSpent] = useState(0);
  const [totalYouOwe, setTotalYouOwe] = useState(0);
  const [totalOwedToYou, setTotalOwedToYou] = useState(0);
  const [owedToMe, setOwedToMe] = useState(0);
  const [iOwe, setIOwe] = useState(0);

  // Raw lists for computation
  const [personalExps, setPersonalExps] = useState<PersonalExpense[]>([]);
  const [groupExps, setGroupExps] = useState<Expense[]>([]);
  const [groupSettlements, setGroupSettlements] = useState<any[]>([]);

  // Chart Data & Collapsible toggle
  const [chartData, setChartData] = useState<any[]>([]);
  const [showChart, setShowChart] = useState(false);

  // Authenticate user
  useEffect(() => {
    if (isGuestMode()) {
      const gUser = getGuestUser();
      setUserName(gUser.name);
      setCurrentUser(gUser);
      fetchDashboardData(gUser.id);
    } else {
      const checkAuth = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/login');
        } else {
          setUserName(session.user.user_metadata?.full_name || 'User');
          setCurrentUser(session.user);
          fetchDashboardData(session.user.id);
        }
      };
      checkAuth();
    }

    const refreshHandler = () => {
      if (currentUser) fetchDashboardData(currentUser.id);
    };
    window.addEventListener('refresh-dashboard-data', refreshHandler);
    return () => window.removeEventListener('refresh-dashboard-data', refreshHandler);
  }, [router]);

  // Re-run calculations when raw data changes
  useEffect(() => {
    if (currentUser) {
      processCalculations(currentUser.id);
    }
  }, [currentUser, personalExps, groupExps, groupSettlements]);

  const fetchDashboardData = async (userId: string) => {
    setLoading(true);
    try {
      // 1. Fetch personal expenses
      const pExpenses = await getPersonalExpenses();
      setPersonalExps(pExpenses);

      // 2. Fetch groups
      const groupsList = await getGroups('active');
      setGroups(groupsList);
      const groupIds = groupsList.map(g => g.id);
      
      const allGroupExpenses = await getBatchExpenses(groupIds);
      const allGroupSettlements = await getBatchSettlements(groupIds);
      
      setGroupExps(allGroupExpenses);
      setGroupSettlements(allGroupSettlements);

      // Fetch group members map
      const membersMap: Record<string, Profile[]> = {};
      await Promise.all(groupsList.map(async (g) => {
        try {
          membersMap[g.id] = await getGroupMembers(g.id);
        } catch (e) {
          console.error(`Failed to fetch members for group ${g.id}`, e);
          membersMap[g.id] = [];
        }
      }));
      setGroupMembersMap(membersMap);

      // 3. Fetch Borrow records (Dues)
      const bRecords = await getBorrowRecords();
      
      // Compute dues totals
      let owedAccum = 0;
      let oweAccum = 0;
      bRecords.forEach(r => {
        if (!r.settled) {
          if (r.lender_id === userId) {
            owedAccum += Number(r.amount);
          } else {
            oweAccum += Number(r.amount);
          }
        }
      });
      setOwedToMe(owedAccum);
      setIOwe(oweAccum);

    } catch (e: any) {
      showToast(e.message || 'Error updating dashboard analytics', 'error');
    } finally {
      setLoading(false);
    }
  };

  const processCalculations = (userId: string) => {
    // Default to the current month's start date
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);

    // Filter personal expenses (this month only)
    const filteredPersonal = personalExps.filter(pe => {
      const peDate = new Date(pe.date);
      return peDate >= startDate;
    });

    // Filter group expenses (this month only)
    const filteredGroup = groupExps.filter(ge => {
      const geDate = new Date(ge.date);
      return geDate >= startDate;
    });

    // Filter group settlements (this month only)
    const filteredSettles = groupSettlements.filter(s => {
      const sDate = new Date(s.date);
      return sDate >= startDate;
    });

    // Calculate you owe / owed to you
    let youOwe = 0;
    let owedToYou = 0;

    filteredGroup.forEach(exp => {
      if (exp.added_by === userId) {
        // You paid. Others owe you
        const othersSplits = exp.splits?.filter(s => s.user_id !== userId) || [];
        othersSplits.forEach(s => {
          owedToYou += Number(s.share_amount);
        });
      } else {
        // Someone else paid. Do you owe?
        const mySplit = exp.splits?.find(s => s.user_id === userId);
        if (mySplit) {
          youOwe += Number(mySplit.share_amount);
        }
      }
    });

    // Adjust with settlements
    filteredSettles.forEach(s => {
      if (s.from_user === userId) {
        // You paid someone to settle
        youOwe -= Number(s.amount);
      }
      if (s.to_user === userId) {
        // Someone paid you to settle
        owedToYou -= Number(s.amount);
      }
    });

    setTotalYouOwe(youOwe > 0 ? youOwe : 0);
    setTotalOwedToYou(owedToYou > 0 ? owedToYou : 0);

    // Calculate group-by-group balances across all group history (not just this month)
    const gBalances: Record<string, number> = {};
    groups.forEach(g => { gBalances[g.id] = 0; });

    groupExps.forEach(exp => {
      const gid = exp.group_id;
      if (gBalances[gid] === undefined) gBalances[gid] = 0;
      
      if (exp.added_by === userId) {
        const othersSplits = exp.splits?.filter(s => s.user_id !== userId) || [];
        othersSplits.forEach(s => {
          gBalances[gid] += Number(s.share_amount);
        });
      } else {
        const mySplit = exp.splits?.find(s => s.user_id === userId);
        if (mySplit) {
          gBalances[gid] -= Number(mySplit.share_amount);
        }
      }
    });

    groupSettlements.forEach(s => {
      const gid = s.group_id;
      if (gBalances[gid] === undefined) gBalances[gid] = 0;

      if (s.from_user === userId) {
        gBalances[gid] += Number(s.amount);
      }
      if (s.to_user === userId) {
        gBalances[gid] -= Number(s.amount);
      }
    });
    setGroupBalances(gBalances);

    // Total Spent = personal spent + your share of group expenses (this month only)
    let personalTotal = filteredPersonal.reduce((acc, curr) => acc + Number(curr.amount), 0);
    let groupShareTotal = 0;
    filteredGroup.forEach(exp => {
      const mySplit = exp.splits?.find(s => s.user_id === userId);
      if (mySplit) {
        groupShareTotal += Number(mySplit.share_amount);
      }
    });
    setTotalSpent(personalTotal + groupShareTotal);

    // Assemble category breakdown for charts (this month only)
    const categorySpent: Record<string, number> = {};
    filteredPersonal.forEach(pe => {
      categorySpent[pe.category] = (categorySpent[pe.category] || 0) + Number(pe.amount);
    });
    filteredGroup.forEach(ge => {
      const mySplit = ge.splits?.find(s => s.user_id === userId);
      if (mySplit) {
        const cat = ge.description.toLowerCase().includes('rent') ? 'Rent' : 
                    ge.description.toLowerCase().includes('food') || ge.description.toLowerCase().includes('dinner') ? 'Food' :
                    ge.description.toLowerCase().includes('travel') || ge.description.toLowerCase().includes('flight') ? 'Travel' :
                    'Others';
        categorySpent[cat] = (categorySpent[cat] || 0) + Number(mySplit.share_amount);
      }
    });

    // Assemble chart data
    const chartFormat = Object.entries(categorySpent).map(([name, value]) => ({
      name,
      value: Math.round(value)
    }));
    setChartData(chartFormat.sort((a, b) => b.value - a.value));
  };

  const netGroupBalance = totalOwedToYou - totalYouOwe;
  const netDuesBalance = owedToMe - iOwe;
  const netBalance = netGroupBalance + netDuesBalance;

  const activeGroups = groups.filter(g => g.status === 'active');

  if (loading || !currentUser) {
    return <SkeletonDashboard />;
  }

  return (
    <div className="space-y-6 pb-6 text-text-primary">
      {/* 1. Welcome Greeting & Net Balance */}
      <div className="text-left py-1">
        <h1 className="text-[13px] font-normal text-text-secondary leading-[1.4]">
          Hi {userName.split(' ')[0]}
        </h1>
        <div className="mt-2">
          {netBalance > 0.01 ? (
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-8 h-8 text-success stroke-[2.5px] flex-shrink-0" />
              <span className="text-[32px] font-bold text-success tracking-tight block leading-[1.2]">
                You're owed {formatCurrency(netBalance)}
              </span>
            </div>
          ) : netBalance < -0.01 ? (
            <div className="flex items-center gap-2">
              <ArrowDownRight className="w-8 h-8 text-warning stroke-[2.5px] flex-shrink-0" />
              <span className="text-[32px] font-bold text-warning tracking-tight block leading-[1.2]">
                You owe {formatCurrency(Math.abs(netBalance))}
              </span>
            </div>
          ) : (
            <span className="text-[32px] font-bold text-text-primary tracking-tight block leading-[1.2]">
              All settled up
            </span>
          )}
        </div>
      </div>

      {/* 2. 3-Card Summary Row */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {/* Groups Card */}
        <Link 
          href="/groups"
          className="bg-surface border border-border p-4 rounded-xl text-left hover:border-primary transition-all shadow-subtle"
        >
          <span className="text-[13px] font-normal text-text-secondary block">Groups</span>
          <div className="flex items-center gap-1 mt-1">
            {netGroupBalance > 0.01 && <ArrowUpRight className="w-3.5 h-3.5 text-success stroke-[2.5px] flex-shrink-0" />}
            {netGroupBalance < -0.01 && <ArrowDownRight className="w-3.5 h-3.5 text-warning stroke-[2.5px] flex-shrink-0" />}
            <span className={`text-[15px] font-semibold truncate leading-[1.4] ${
              netGroupBalance > 0.01 
                ? 'text-success' 
                : netGroupBalance < -0.01 
                  ? 'text-warning' 
                  : 'text-text-secondary'
            }`}>
              {netGroupBalance > 0.01 ? '+' : ''}{formatCurrency(netGroupBalance)}
            </span>
          </div>
        </Link>

        {/* Dues Card */}
        <Link 
          href="/dues"
          className="bg-surface border border-border p-4 rounded-xl text-left hover:border-primary transition-all shadow-subtle"
        >
          <span className="text-[13px] font-normal text-text-secondary block">Dues</span>
          <div className="flex items-center gap-1 mt-1">
            {netDuesBalance > 0.01 && <ArrowUpRight className="w-3.5 h-3.5 text-success stroke-[2.5px] flex-shrink-0" />}
            {netDuesBalance < -0.01 && <ArrowDownRight className="w-3.5 h-3.5 text-warning stroke-[2.5px] flex-shrink-0" />}
            <span className={`text-[15px] font-semibold truncate leading-[1.4] ${
              netDuesBalance > 0.01 
                ? 'text-success' 
                : netDuesBalance < -0.01 
                  ? 'text-warning' 
                  : 'text-text-secondary'
            }`}>
              {netDuesBalance > 0.01 ? '+' : ''}{formatCurrency(netDuesBalance)}
            </span>
          </div>
        </Link>

        {/* This Month's Spending Card */}
        <Link 
          href="/personal"
          className="bg-surface border border-border p-4 rounded-xl text-left hover:border-primary transition-all shadow-subtle"
        >
          <span className="text-[13px] font-normal text-text-secondary block truncate">Spending</span>
          <span className="text-[15px] font-semibold text-text-primary mt-1 block truncate leading-[1.4]">
            {formatCurrency(totalSpent)}
          </span>
        </Link>
      </div>

      {/* 3. Active Groups Section */}
      <div className="space-y-3">
        <h2 className="text-[17px] font-semibold text-text-primary text-left leading-[1.2]">Active Groups</h2>
        {activeGroups.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-6 text-center shadow-subtle flex flex-col items-center justify-center">
            <Users className="w-8 h-8 text-text-secondary mb-2" />
            <p className="text-[13px] text-text-secondary mb-4">No active groups yet.</p>
            <Link
              href="/groups"
              className="bg-primary hover:bg-primary-hover text-white px-3.5 py-2 rounded-lg text-[15px] font-medium transition-colors shadow-subtle"
            >
              Start or Join a Group
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeGroups.map(g => {
              const bal = groupBalances[g.id] || 0;
              const groupMembers = groupMembersMap[g.id] || [];
              
              return (
                <Link
                  key={g.id}
                  href={`/groups/${g.id}`}
                  className="bg-surface border border-border p-4 rounded-xl flex items-center justify-between hover:border-primary transition-all shadow-subtle"
                >
                  <div className="flex flex-col gap-1.5 text-left">
                    <span className="font-medium text-text-primary text-[15px] leading-[1.4]">
                      {g.name}
                    </span>
                    {/* Overlapping member avatars */}
                    <div className="flex items-center -space-x-1.5 overflow-hidden">
                      {groupMembers.slice(0, 4).map((member) => (
                        <img
                          key={member.id}
                          src={member.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.name}`}
                          alt={member.name}
                          className="w-5.5 h-5.5 rounded-full border border-surface bg-background object-cover"
                          title={member.name}
                        />
                      ))}
                      {groupMembers.length > 4 && (
                        <div className="w-5.5 h-5.5 rounded-full border border-surface bg-background flex items-center justify-center text-[9px] font-medium text-text-secondary">
                          +{groupMembers.length - 4}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    {bal > 0.01 ? (
                      <div className="flex flex-col items-end">
                        <span className="text-[13px] font-normal text-text-secondary block">Owed to you</span>
                        <div className="flex items-center gap-0.5">
                          <ArrowUpRight className="w-3 h-3 text-success stroke-[2.5px]" />
                          <span className="text-[15px] font-semibold text-success leading-[1.4]">
                            {formatCurrency(bal)}
                          </span>
                        </div>
                      </div>
                    ) : bal < -0.01 ? (
                      <div className="flex flex-col items-end">
                        <span className="text-[13px] font-normal text-text-secondary block">You owe</span>
                        <div className="flex items-center gap-0.5">
                          <ArrowDownRight className="w-3 h-3 text-warning stroke-[2.5px]" />
                          <span className="text-[15px] font-semibold text-warning leading-[1.4]">
                            {formatCurrency(Math.abs(bal))}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-[13px] font-normal text-text-secondary">
                        Settled
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Collapsible Category Spend Chart */}
      <div className="bg-surface border border-border rounded-xl p-4 text-left shadow-subtle">
        <button 
          onClick={() => setShowChart(!showChart)}
          className="w-full flex items-center justify-between font-semibold text-[15px] text-text-primary focus:outline-none"
        >
          <span>Spending Breakdown</span>
          <span className="text-[13px] text-text-secondary font-normal">{showChart ? 'Hide ▲' : 'Show ▼'}</span>
        </button>

        {showChart && (
          <div className="mt-4 animate-in fade-in duration-200">
            <CategorySpendChart chartData={chartData} />
          </div>
        )}
      </div>
    </div>
  );
}
