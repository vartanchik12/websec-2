document.addEventListener("DOMContentLoaded", () => {
    const map = L.map('map').setView([20, 0], 2);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    let currentCities = [];

    async function loadDataset() {
        try {
            const response = await fetch('top1000.csv');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const csvText = await response.text();

            const lines = csvText.trim().split('\n');
            if (lines.length < 2) throw new Error('Файл пуст');

            const headers = lines[0].split(';');
            const popIdx = headers.indexOf('population');
            const latIdx = headers.indexOf('latitude_dadata');
            const lonIdx = headers.indexOf('longitude_dadata');
            const nameIdx = headers.indexOf('settlement');
            const objNameIdx = headers.indexOf('object_name');

            const parsedCities = [];

            for (let k = 1; k < lines.length; k++) {
                const values = lines[k].split(/;(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                if (values.length !== headers.length) continue;

                let cityName = values[nameIdx] ? values[nameIdx].replace(/^"|"$/g, '') : '';
                if (!cityName || cityName.trim() === '') {
                    cityName = values[objNameIdx] ? values[objNameIdx].replace(/^"|"$/g, '') : '';
                }

                const city = {
                    name: cityName,
                    lat: parseFloat(values[latIdx].replace(',', '.')),
                    lon: parseFloat(values[lonIdx].replace(',', '.')),
                    population: parseInt(values[popIdx], 10)
                };

                if (!isNaN(city.lat) && !isNaN(city.lon)) {
                    parsedCities.push(city);
                }
            }

            currentCities = parsedCities;
            
            console.log(`Успешно загружено ${currentCities.length} городов из top1000.csv`);

            renderMarkers(currentCities);
            
        } catch (e) {
            console.error("Ошибка при загрузке top1000.csv:", e);
            alert("Не удалось загрузить базу городов. Убедитесь, что вы запустили локальный сервер.");
        }
    }

    function renderMarkers(citiesArray) {
        for (let k = 0; k < citiesArray.length; k++) {
            const city = citiesArray[k];
            const marker = L.marker([city.lat, city.lon]).addTo(map);
            
            marker.bindTooltip(city.name);
            marker.on('click', () => {
                openWeatherModal(city);
            });
        }
    }


    loadDataset();


    const searchInput = document.getElementById('city-search');
    const searchResults = document.getElementById('search-results');

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        searchResults.innerHTML = '';
        
        if (query.length === 0) {
            searchResults.classList.add('hidden');
            return;
        }

        const filtered = currentCities.filter(c => c.name.toLowerCase().includes(query));
        
        if (filtered.length > 0) {
            searchResults.classList.remove('hidden');
            
            for (let g = 0; g < filtered.length; g++) {
                const li = document.createElement('li');
                li.textContent = filtered[g].name;
                li.addEventListener('click', () => {
                    map.setView([filtered[g].lat, filtered[g].lon], 8);
                    openWeatherModal(filtered[g]);
                    searchResults.classList.add('hidden');
                    searchInput.value = '';
                });
                searchResults.appendChild(li);
            }
        } else {
            searchResults.classList.add('hidden');
        }
    });

    let activeChart = null;
    const modal = document.getElementById('chart-modal');
    const closeModal = document.getElementById('close-modal');

    closeModal.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    async function openWeatherModal(city) {
        document.getElementById('modal-title').textContent = `Прогноз погоды: ${city.name}`;
        modal.classList.remove('hidden');
        
        const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&daily=temperature_2m_max,precipitation_sum,windspeed_10m_max&timezone=auto`;
        
        try {
            const response = await fetch(apiUrl);
            const weatherData = await response.json();
            drawChart(weatherData.daily);
        } catch (error) {
            console.error("Ошибка сети:", error);
            alert("Не удалось загрузить данные о погоде.");
        }
    }

    function drawChart(dailyData) {
        const ctx = document.getElementById('weather-chart').getContext('2d');
        
        if (activeChart) {
            activeChart.destroy();
        }

        activeChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dailyData.time,
                datasets: [
                    {
                        label: 'Температура (°C)',
                        data: dailyData.temperature_2m_max,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231, 76, 60, 0.2)',
                        yAxisID: 'y',
                        tension: 0.3
                    },
                    {
                        label: 'Ветер (км/ч)',
                        data: dailyData.windspeed_10m_max,
                        borderColor: '#f1c40f',
                        borderDash: [5, 5],
                        yAxisID: 'y',
                        tension: 0.3
                    },
                    {
                        label: 'Осадки (мм)',
                        data: dailyData.precipitation_sum,
                        type: 'bar',
                        backgroundColor: 'rgba(52, 152, 219, 0.6)',
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: { display: true, text: 'Температура / Ветер' }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: { display: true, text: 'Осадки (мм)' },
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }
});