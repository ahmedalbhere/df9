document.addEventListener('DOMContentLoaded', function() {
    // تحميل البيانات مع معالجة الأخطاء
    let transactions = [];
    let debts = [];
    
    try {
        transactions = JSON.parse(localStorage.getItem('transactions')) || [];
        debts = JSON.parse(localStorage.getItem('debts')) || [];
    } catch (e) {
        console.error('خطأ في قراءة البيانات:', e);
        alert('حدث خطأ في تحميل البيانات. الرجاء تحديث الصفحة.');
    }

    // عناصر DOM
    const reportType = document.getElementById('report-type');
    const reportMonth = document.getElementById('report-month');
    const reportYear = document.getElementById('report-year');
    const reportChartEl = document.getElementById('reportChart');
    const reportTable = document.getElementById('report-table').querySelector('tbody');
    const reportIncomeEl = document.getElementById('report-income');
    const reportExpenseEl = document.getElementById('report-expense');
    const reportBalanceEl = document.getElementById('report-balance');
    const exportPdfBtn = document.getElementById('export-pdf');
    const loadingIndicator = document.getElementById('loading-indicator');

    // تهيئة القيم الافتراضية
    function initDefaults() {
        const today = new Date();
        
        if (reportMonth) {
            reportMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        }
        
        if (reportYear) {
            reportYear.value = today.getFullYear();
        }
    }

    // دالة مساعدة لتحويل التاريخ إلى صيغة YYYY-MM
    function getYearMonth(dateString) {
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                throw new Error('تاريخ غير صالح');
            }
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        } catch (e) {
            console.error('خطأ في تحويل التاريخ:', dateString, e);
            const today = new Date();
            return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        }
    }

    // دالة مساعدة للحصول على اسم الشهر العربي
    function getArabicMonthName(monthIndex) {
        const months = [
            'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
            'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
        ];
        return months[monthIndex] || 'غير معروف';
    }

    // عرض مؤشر التحميل
    function showLoading() {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
    }

    // إخفاء مؤشر التحميل
    function hideLoading() {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }

    // تقرير شهري
    async function renderMonthlyReport(month) {
        showLoading();
        
        try {
            // فلترة المعاملات حسب الشهر المحدد
            const filtered = transactions.filter(trx => {
                const trxMonth = getYearMonth(trx.date);
                return trxMonth === month;
            });

            if (filtered.length === 0) {
                alert('لا توجد معاملات لهذا الشهر');
                hideLoading();
                return;
            }

            // حساب الإجماليات
            const income = filtered.reduce((sum, trx) => trx.type === 'income' ? sum + parseFloat(trx.amount) : sum, 0);
            const expense = filtered.reduce((sum, trx) => trx.type === 'expense' ? sum + parseFloat(trx.amount) : sum, 0);
            const balance = income - expense;
            
            // تحديث الإجماليات
            updateSummary(income, expense, balance);
            
            // تجميع البيانات حسب اليوم
            const year = parseInt(month.split('-')[0]);
            const monthNum = parseInt(month.split('-')[1]);
            const daysInMonth = new Date(year, monthNum, 0).getDate();
            
            const dailyData = Array(daysInMonth).fill().map((_, i) => ({
                day: i + 1,
                income: 0,
                expense: 0
            }));
            
            filtered.forEach(trx => {
                const day = new Date(trx.date).getDate() - 1;
                if (day >= 0 && day < daysInMonth) {
                    if (trx.type === 'income') {
                        dailyData[day].income += parseFloat(trx.amount);
                    } else {
                        dailyData[day].expense += parseFloat(trx.amount);
                    }
                }
            });
            
            // عرض المخطط
            renderChart(
                dailyData.map(d => d.day),
                dailyData.map(d => d.income),
                dailyData.map(d => d.expense),
                'يوم',
                `تقرير شهري - ${getArabicMonthName(monthNum - 1)} ${year}`
            );
            
            // عرض الجدول
            renderTable([
                { category: 'المدخول', amount: income, percentage: 100 },
                { category: 'المصروف', amount: expense, percentage: 100 },
                { category: 'صافي الرصيد', amount: balance, percentage: 100 }
            ]);
        } catch (error) {
            console.error('خطأ في إنشاء التقرير الشهري:', error);
            alert('حدث خطأ أثناء إنشاء التقرير الشهري');
        } finally {
            hideLoading();
        }
    }

    // تقرير حسب الفئة
    async function renderCategoryReport(month) {
        showLoading();
        
        try {
            // فلترة المعاملات حسب الشهر المحدد
            const filtered = month ? 
                transactions.filter(trx => getYearMonth(trx.date) === month) :
                [...transactions];
            
            if (filtered.length === 0) {
                alert('لا توجد معاملات لعرضها');
                hideLoading();
                return;
            }

            // حساب الإجماليات
            const income = filtered.reduce((sum, trx) => trx.type === 'income' ? sum + parseFloat(trx.amount) : sum, 0);
            const expense = filtered.reduce((sum, trx) => trx.type === 'expense' ? sum + parseFloat(trx.amount) : sum, 0);
            const balance = income - expense;
            
            // تحديث الإجماليات
            updateSummary(income, expense, balance);
            
            // تجميع البيانات حسب الفئة
            const categories = {};
            
            filtered.forEach(trx => {
                const categoryKey = trx.category || 'other';
                if (!categories[categoryKey]) {
                    categories[categoryKey] = { 
                        name: getCategoryName(categoryKey),
                        income: 0, 
                        expense: 0 
                    };
                }
                
                if (trx.type === 'income') {
                    categories[categoryKey].income += parseFloat(trx.amount);
                } else {
                    categories[categoryKey].expense += parseFloat(trx.amount);
                }
            });
            
            // تحضير البيانات للرسم البياني
            const labels = Object.values(categories).map(cat => cat.name);
            const incomeData = Object.values(categories).map(cat => cat.income);
            const expenseData = Object.values(categories).map(cat => cat.expense);
            
            // عرض المخطط
            renderChart(
                labels,
                incomeData,
                expenseData,
                'فئة',
                month ? `تقرير الفئات - ${getYearMonth(month)}` : 'تقرير الفئات - كل الشهور'
            );
            
            // تحضير البيانات للجدول
            const tableData = Object.values(categories)
                .filter(cat => cat.income > 0 || cat.expense > 0)
                .map(cat => ({
                    category: cat.name,
                    amount: cat.income + cat.expense,
                    percentage: ((cat.income + cat.expense) / (income + expense)) * 100
                }))
                .sort((a, b) => b.amount - a.amount);
            
            // عرض الجدول
            renderTable(tableData);
        } catch (error) {
            console.error('خطأ في إنشاء تقرير الفئات:', error);
            alert('حدث خطأ أثناء إنشاء تقرير الفئات');
        } finally {
            hideLoading();
        }
    }

    // تقرير سنوي
    async function renderYearlyReport() {
        showLoading();
        
        try {
            if (transactions.length === 0) {
                alert('لا توجد معاملات لعرضها');
                hideLoading();
                return;
            }

            // حساب الإجماليات
            const income = transactions.reduce((sum, trx) => trx.type === 'income' ? sum + parseFloat(trx.amount) : sum, 0);
            const expense = transactions.reduce((sum, trx) => trx.type === 'expense' ? sum + parseFloat(trx.amount) : sum, 0);
            const balance = income - expense;
            
            // تحديث الإجماليات
            updateSummary(income, expense, balance);
            
            // تجميع البيانات حسب الشهر
            const monthlyData = Array(12).fill().map(() => ({ 
                income: 0, 
                expense: 0 
            }));
            
            transactions.forEach(trx => {
                const month = new Date(trx.date).getMonth();
                if (month >= 0 && month < 12) {
                    if (trx.type === 'income') {
                        monthlyData[month].income += parseFloat(trx.amount);
                    } else {
                        monthlyData[month].expense += parseFloat(trx.amount);
                    }
                }
            });
            
            // عرض المخطط
            renderChart(
                ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 
                 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
                monthlyData.map(m => m.income),
                monthlyData.map(m => m.expense),
                'شهر',
                'تقرير سنوي'
            );
            
            // عرض الجدول
            renderTable([
                { category: 'المدخول السنوي', amount: income, percentage: 100 },
                { category: 'المصروف السنوي', amount: expense, percentage: 100 },
                { category: 'صافي الرصيد', amount: balance, percentage: 100 }
            ]);
        } catch (error) {
            console.error('خطأ في إنشاء التقرير السنوي:', error);
            alert('حدث خطأ أثناء إنشاء التقرير السنوي');
        } finally {
            hideLoading();
        }
    }

    // عرض المخطط
    function renderChart(labels, incomeData, expenseData, labelType, title = '') {
        if (!reportChartEl) return;
        
        const ctx = reportChartEl.getContext('2d');
        
        // إذا كان هناك مخطط موجود، قم بتدميره أولاً
        if (reportChartEl.chart) {
            reportChartEl.chart.destroy();
        }
        
        reportChartEl.chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'مدخول',
                        data: incomeData,
                        backgroundColor: 'rgba(76, 201, 240, 0.7)',
                        borderColor: 'rgba(76, 201, 240, 1)',
                        borderWidth: 1
                    },
                    {
                        label: 'مصروف',
                        data: expenseData,
                        backgroundColor: 'rgba(247, 37, 133, 0.7)',
                        borderColor: 'rgba(247, 37, 133, 1)',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: !!title,
                        text: title,
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        position: 'top',
                        rtl: true,
                        labels: {
                            font: {
                                size: 14
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.raw.toFixed(2)} جنيه`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + ' ج';
                            },
                            font: {
                                size: 12
                            }
                        }
                    },
                    x: {
                        ticks: {
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    }

    // عرض الجدول
    function renderTable(data) {
        if (!reportTable) return;
        
        reportTable.innerHTML = '';
        
        if (!data || data.length === 0) {
            reportTable.innerHTML = '<tr><td colspan="3" class="text-center">لا توجد بيانات لعرضها</td></tr>';
            return;
        }
        
        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.category}</td>
                <td>${item.amount.toFixed(2)} جنيه</td>
                <td>${item.percentage.toFixed(1)}%</td>
            `;
            reportTable.appendChild(row);
        });
    }

    // تحديث ملخص التقرير
    function updateSummary(income, expense, balance) {
        if (reportIncomeEl) reportIncomeEl.textContent = income.toFixed(2) + ' جنيه';
        if (reportExpenseEl) reportExpenseEl.textContent = expense.toFixed(2) + ' جنيه';
        if (reportBalanceEl) {
            reportBalanceEl.textContent = balance.toFixed(2) + ' جنيه';
            reportBalanceEl.style.color = balance >= 0 ? 'var(--income-color)' : 'var(--expense-color)';
        }
    }

    // اسم الفئة
    function getCategoryName(category) {
        const categories = {
            'salary': 'راتب',
            'investment': 'استثمار',
            'gift': 'هدية',
            'food': 'طعام',
            'transport': 'مواصلات',
            'bills': 'فواتير',
            'shopping': 'تسوق',
            'other-income': 'أخرى (مدخول)',
            'other-expense': 'أخرى (مصروف)'
        };
        return categories[category] || 'عام';
    }

    // عرض التقرير
    async function renderReport() {
        if (!transactions || transactions.length === 0) {
            alert('لا توجد معاملات لعرضها. الرجاء إضافة معاملات أولاً.');
            return;
        }
        
        const type = reportType ? reportType.value : 'monthly';
        const month = reportMonth ? reportMonth.value : null;
        
        switch(type) {
            case 'monthly':
                await renderMonthlyReport(month);
                break;
            case 'category':
                await renderCategoryReport(month);
                break;
            case 'yearly':
                await renderYearlyReport();
                break;
            default:
                await renderMonthlyReport(month);
        }
    }

    // أحداث التغيير
    if (reportType) reportType.addEventListener('change', renderReport);
    if (reportMonth) reportMonth.addEventListener('change', renderReport);
    if (reportYear) reportYear.addEventListener('change', function() {
        if (reportMonth) reportMonth.value = `${this.value}-01`;
        renderReport();
    });

    // حدث تصدير PDF
    if (exportPdfBtn) {
        exportPdfBtn.addEventListener('click', function() {
            alert('سيتم تطوير ميزة التصدير إلى PDF في الإصدارات القادمة');
        });
    }

    // التحميل الأولي
    initDefaults();
    renderReport();
});
