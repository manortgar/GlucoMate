import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Dimensions
} from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import Svg, { Path, Line, Text as SvgText } from 'react-native-svg';
import * as d3Shape from 'd3-shape';
import * as d3Scale from 'd3-scale';
import { FontAwesome6, MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import InsulinModal from './InsulinModal';
import FoodModal from './FoodModal';
import { useFonts } from 'expo-font';



const { width, height } = Dimensions.get('window');
const GRAPH_HEIGHT = height * 0.5;
const GRAPH_WIDTH = width;

const GlucoseScanner = () => {
    const [tagData, setTagData] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isNfcSupported, setIsNfcSupported] = useState(false);
    const [waitingForScan, setWaitingForScan] = useState(false);

    // Modal Events State
    const [userProfile, setUserProfile] = useState(null);
    const [activeInsulins, setActiveInsulins] = useState([]);
    const [isInsulinModalVisible, setInsulinModalVisible] = useState(false);
    const [isSavingEvent, setIsSavingEvent] = useState(false);
    const [showFastInsulin, setShowFastInsulin] = useState(true);
    const [isFoodModalVisible, setFoodModalVisible] = useState(false);

    const [fontsLoaded] = useFonts({
        'ArrowFont': require('./assets/arrow-font.ttf'),
    });

    // IP DEL BACKEND (Actualizar si cambia)
    const backendUrlHistory = 'http://192.168.1.24:3000/api/glucose/history';
    const backendUrlUpload = 'http://192.168.1.24:3000/api/glucose';
    const backendUrlProfile = 'http://192.168.1.24:3000/api/profile';
    const backendUrlInsulinEvents = 'http://192.168.1.24:3000/api/insulin-events';
    const backendUrlFoodEvents = 'http://192.168.1.24:3000/api/food-events';

    useEffect(() => {
        const initNfc = async () => {
            try {
                await NfcManager.start();
                const supported = await NfcManager.isSupported();
                setIsNfcSupported(supported);
            } catch (e) {
                console.warn('Error inicializando NFC:', e);
            }
        };
        initNfc();

        fetchHistory();
        fetchProfile();
        fetchEvents();

        return () => {
            NfcManager.cancelTechnologyRequest();
        };
    }, []);

    // Traemos el Mock de 12 horas desde la BD
    const fetchHistory = async () => {
        try {
            const response = await fetch(backendUrlHistory);
            const data = await response.json();
            console.log(data);
            if (data.length > 0) {
                // Adaptamos las fechas String a objetos Date para D3
                const formatted = data.map(d => ({
                    value: d.glucose_value,
                    time: new Date(d.reading_time)
                }));
                // Si Postgres nos devuelve muchisimos, nos quedamos maximo las ultimas 12h
                setHistoryData(formatted);

                // Simulamos que el último punto del historial es la lectura actual al abrir
                setTagData({
                    bgs: [{
                        sgv: formatted[formatted.length - 1].value,
                        datetime: formatted[formatted.length - 1].time.getTime(),
                        direction: formatted[formatted.length - 1].trend || 'Flat'
                    }]
                });
            } else {
                const date = new Date();
                setHistoryData([{
                    value: 200,
                    time: date,
                }]);
            }
        } catch (error) {
            console.error('Error cargando historial:', error);
        }
    };

    const fetchProfile = async () => {
        try {
            const res = await fetch(backendUrlProfile);
            const data = await res.json();
            setUserProfile(data);
        } catch (e) {
            console.error('Error cargando perfil:', e);
        }
    };

    const fetchEvents = async () => { // fetchInsulins
        try {
            const res = await fetch(backendUrlInsulinEvents + '?hours=24');
            const data = await res.json();
            setActiveInsulins(data);
        } catch (e) {
            console.error('Error cargando eventos de insulina:', e);
        }
    };

    const handleSaveInsulin = async (eventData) => {
        setIsSavingEvent(true);
        try {
            const res = await fetch(backendUrlInsulinEvents, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventData),
            });
            if (res.ok) {
                setInsulinModalVisible(false);
                fetchEvents(); // Recargar inyecciones activas
            }
        } catch (error) {
            console.error('Error guardando evento:', error);
        } finally {
            setIsSavingEvent(false);
        }
    };

    const handleSaveFood = async (eventData) => {
        setIsSavingEvent(true);
        try {
            const res = await fetch(backendUrlFoodEvents, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventData),
            });
            if (res.ok) {
                setFoodModalVisible(false);
                fetchEvents(); // Recargar inyecciones activas si hubo bolo
            }
        } catch (error) {
            console.error('Error guardando comida:', error);
        } finally {
            setIsSavingEvent(false);
        }
    };

    const startInteraction = async () => {
        setWaitingForScan(true);
        try {
            await NfcManager.requestTechnology(NfcTech.NfcV);
            NfcManager.cancelTechnologyRequest();
            setWaitingForScan(false);
            await fetchJugglucoData();
            await fetchJugglucoData2();
        } catch (error) {
            setWaitingForScan(false);
            NfcManager.cancelTechnologyRequest();
        }
    };

    const fetchJugglucoData = async () => {
        setIsLoading(true);
        try {
            const url = 'http://127.0.0.1:17580/pebble?units=mg';

            console.log(`Haciendo fetch a: ${url}`);

            const response = await fetch(url);
            const data = await response.json();

            console.log('\n================ DATOS JUGGLUCO ================\n');
            console.log(JSON.stringify(data, null, 2));
            console.log('\n================================================\n');

            setTagData(data);

            if (data && data.bgs && data.bgs.length > 0) {
                console.log(`Lectura actual detectada: ${data.bgs[0].sgv} mg/dL. Subiendo al backend...`);
                await saveToBackend(data.bgs[0]);
                await fetchHistory(); // Recargar historial tras escanear para actualizar el gráfico
            }
        } catch (error) {
            console.warn('Juggluco no disponible localmente.', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchJugglucoData2 = async () => {
        try {
            const url = 'http://127.0.0.1:17580/sgv.json?count=1';
            const response = await fetch(url);
            const data = await response.json();
            const lastGlucose = data[0];
            // { sgv: 112, direction: "Flat", datetime: 1710856000000, ... }
            console.log(`Haciendo fetch a: ${url}`);



            console.log('\n================ DATOS JUGGLUCO2 ================\n');
            console.log(JSON.stringify(data, null, 2));
            console.log('\n================================================\n');

        } catch (error) {
            console.warn('Juggluco no disponible localmente.', error);
        }
    };

    const saveToBackend = async (bgData) => {
        try {
            const response = await fetch(backendUrlUpload, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: 1,
                    value: parseInt(bgData.sgv, 10),
                    trend: bgData.direction,
                    timestamp: bgData.datetime
                })
            });

            if (response.ok) {
                console.log('✅ Glucosa guardada en PostgreSQL correctamente a través de Node.js');
            } else {
                console.warn('⚠️ El backend recibió los datos pero devolvió un error:', response.status);
            }
        } catch (error) {
            console.warn('❌ Falla en silencio: No se pudo conectar con el Backend Node.js en', backendUrlUpload);
        }
    };

    // ----- LOGICA D3.js ----- //
    const renderGraph = () => {
        const max_12h = Math.max(...historyData.map(d => d.value));
        const maxY = max_12h + 50; // El tope dinámico solicitado
        const minY = 50; // Mínimo fijo

        const AHORA = new Date().getTime();
        const UNA_HORA_MS = 60 * 60 * 1000;

        const minTime = AHORA - (11 * UNA_HORA_MS); // 11 horas atrás
        const maxTime = AHORA + (1 * UNA_HORA_MS);  // 1 hora adelante

        // Escalas matemáticas
        const scaleX = d3Scale.scaleTime()
            .domain([minTime, maxTime])
            .range([20, GRAPH_WIDTH - 20]); // Padding lateral 20px

        const scaleY = d3Scale.scaleLinear()
            .domain([minY, maxY])
            .range([GRAPH_HEIGHT - 30, 20]); // El SVG se dibuja de arriba a abajo

        // Generador de la curva
        const lineGenerator = d3Shape.line()
            .x(d => scaleX(d.time))
            .y(d => scaleY(d.value))
            .curve(d3Shape.curveMonotoneX); // Curva suavizada

        const path = lineGenerator(historyData);

        // Guías horizontales clásicas de Diabetes (70 y 180)
        const y70 = scaleY(70);
        const y180 = scaleY(180);

        // Calcular ticks del Eje X (cada 2 horas pares)
        const ticks = [];
        let currentTick = new Date(minTime);
        currentTick.setMinutes(0, 0, 0);

        if (currentTick.getHours() % 2 !== 0) {
            currentTick.setHours(currentTick.getHours() + 1);
        } else if (currentTick.getTime() < minTime) {
            currentTick.setHours(currentTick.getHours() + 2);
        }

        while (currentTick.getTime() <= maxTime) {
            ticks.push(new Date(currentTick));
            currentTick.setHours(currentTick.getHours() + 2);
        }


        return (
            <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT}>
                {/* Rectángulo de rango objetivo original (Verde) */}
                {y180 < (GRAPH_HEIGHT - 30) && y70 > 20 && (
                    <Path d={`M 0 ${y180} L ${GRAPH_WIDTH} ${y180} L ${GRAPH_WIDTH} ${y70} L 0 ${y70} Z`} fill="rgba(200, 230, 201, 0.4)" />
                )}

                {/* Insulinas Rápidas Activas (Fondo Rosado apilado con línea de Pico) */}
                {showFastInsulin && activeInsulins.filter(e => e.insulin_type === 'fast').map(event => {
                    const eventTimeMs = new Date(event.event_time).getTime();
                    const durationMs = (event.duration_hours || 4) * 60 * 60 * 1000;
                    const endTimeMs = eventTimeMs + durationMs;

                    if (endTimeMs < minTime || eventTimeMs > maxTime) return null;
                    const startX = scaleX(eventTimeMs);
                    const endX = scaleX(endTimeMs);

                    let peakLine = null;
                    if (event.peak_hours) {
                        const peakTimeMs = eventTimeMs + (event.peak_hours * 60 * 60 * 1000);
                        if (peakTimeMs >= minTime && peakTimeMs <= maxTime) {
                            const peakX = scaleX(peakTimeMs);
                            peakLine = (
                                <Line
                                    key={`fast-peak-${event.id}`}
                                    x1={peakX} y1={40}
                                    x2={peakX} y2={GRAPH_HEIGHT - 30}
                                    stroke="#e91e63" strokeWidth="2" strokeDasharray="3 3"
                                />
                            );
                        }
                    }

                    return [
                        <Path
                            key={`fast-path-${event.id}`}
                            d={`M ${startX} 40 L ${endX} 40 L ${endX} ${GRAPH_HEIGHT - 30} L ${startX} ${GRAPH_HEIGHT - 30} Z`}
                            fill="rgba(255, 105, 180, 0.3)"
                        />,
                        peakLine
                    ];
                })}

                <Line x1={0} y1={y180} x2={GRAPH_WIDTH} y2={y180} stroke="#b0bec5" strokeWidth="1" strokeDasharray="4 4" />
                <Line x1={0} y1={y70} x2={GRAPH_WIDTH} y2={y70} stroke="#b0bec5" strokeWidth="1" strokeDasharray="4 4" />

                <SvgText x={GRAPH_WIDTH - 30} y={y180 - 5} fontSize="10" fill="#9e9e9e" textAnchor="end">180</SvgText>
                <SvgText x={GRAPH_WIDTH - 30} y={y70 - 5} fontSize="10" fill="#9e9e9e" textAnchor="end">70</SvgText>

                {/* Etiquetas de hora debajo de la línea verde (y=70) */}
                {ticks.map((tick, index) => {
                    const xPos = scaleX(tick.getTime());
                    const formattedTime = `${tick.getHours().toString().padStart(2, '0')}:${tick.getMinutes().toString().padStart(2, '0')}`;
                    return (
                        <SvgText key={`tick-${index}`} x={xPos} y={y70 + 14} fontSize="10" fill="#9e9e9e" textAnchor="middle" fontWeight="bold">
                            {formattedTime}
                        </SvgText>
                    );
                })}


                {/* La Gran Curva Interpolada SVG */}
                <Path d={path} fill="none" stroke="#2196F3" strokeWidth="4" />
            </Svg>
        );
    };

    const getTrendArrow = (direction) => {
        const trends = { 'DoubleUp': '⇈', 'SingleUp': '↑', 'FortyFiveUp': '↗', 'Flat': '→', 'FortyFiveDown': '↘', 'SingleDown': '↓', 'DoubleDown': '⇊', 'None': '↔', 'NOT COMPUTABLE': '?' };
        return trends[direction] || '';
    };

    const renderCurrentGlucose = () => {
        let displayValue = '--';
        let displayArrow = '';
        let valColor = '#9e9e9e'; // Gris por defecto (sin datos/antiguo)

        const bg = (tagData && tagData.bgs && tagData.bgs.length > 0) ? tagData.bgs[0] : null;

        if (bg) {
            const now = new Date().getTime();
            const twelveHoursMs = 12 * 60 * 60 * 1000;
            const isRecent = (now - bg.datetime) < twelveHoursMs;

            if (isRecent) {
                displayValue = bg.sgv;
                displayArrow = getTrendArrow(bg.direction);

                // Color dinámico según la cifra (solo si es reciente)
                valColor = '#2196F3'; // Azul normal
                if (bg.sgv < 70) valColor = '#f44336'; // Rojo hipo
                if (bg.sgv > 180) valColor = '#ff9800'; // Naranja hiper
            }
        }

        return (
            <View style={styles.topHeader}>
                <View style={styles.valueRow}>
                    <Text style={[styles.glucoseValue, { color: valColor }]}>{displayValue}</Text>
                    <Text style={styles.trendArrow}>{displayArrow}</Text>
                </View>
                <Text style={styles.unitText}>mg/dL</Text>
            </View>
        );
    };

    const renderBasalCountdown = () => {
        const latestSlow = activeInsulins.find(e => e.insulin_type === 'slow');

        let remainingHours = '--';
        let isInactive = true;

        if (latestSlow) {
            const eventTimeMs = new Date(latestSlow.event_time).getTime();
            const durationMs = (latestSlow.duration_hours || 24) * 60 * 60 * 1000;
            const endTimeMs = eventTimeMs + durationMs;
            const nowMs = new Date().getTime();

            if (nowMs < endTimeMs) {
                remainingHours = ((endTimeMs - nowMs) / (1000 * 60 * 60)).toFixed(1) + 'h';
                isInactive = false;
            }
        }

        return (
            <View style={styles.basalRowContainer}>
                <View style={[styles.basalBadge, isInactive && styles.basalBadgeInactive]}>
                    <Text style={[styles.basalText, isInactive && styles.basalTextInactive]}>
                        Basal restante: {remainingHours}
                    </Text>
                </View>

                {/* Checkbox para alternar la vista de insulinas rápidas */}
                <TouchableOpacity
                    style={styles.checkboxContainer}
                    onPress={() => setShowFastInsulin(!showFastInsulin)}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons
                        name={showFastInsulin ? "check-circle" : "circle-outline"}
                        size={20}
                        color={showFastInsulin ? "#e91e63" : "#bdbdbd"}
                    />
                    <Text style={[styles.checkboxLabel, !showFastInsulin && { color: '#bdbdbd' }]}>Bolos</Text>
                </TouchableOpacity>
            </View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top']}>
            <View style={styles.container}>
                {/* Botón de Escaneo en la parte superior derecha */}
                <TouchableOpacity
                    style={[styles.headerButton, waitingForScan ? styles.headerButtonActive : null]}
                    onPress={waitingForScan ? () => setWaitingForScan(false) : startInteraction}
                >
                    {isLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <FontAwesome6
                            name={waitingForScan ? "nfc-directional" : "nfc-symbol"}
                            size={35}
                            color="#fff"
                        />
                    )}
                </TouchableOpacity>

                {/* Cabecera Enorme */}
                <View style={styles.headerSpacer}>
                    {renderCurrentGlucose()}
                    {renderBasalCountdown()}
                </View>

                {/* Botones de Acción Rápidos (Comida, Insulina, Ejercicio) */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => setFoodModalVisible(true)}>
                        <Image
                            source={require('./assets/apple.png')}
                            style={{ width: 50, height: 50, tintColor: '#4caf50' }}
                        />
                        <Text style={styles.actionLabel}>Comida</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton} onPress={() => setInsulinModalVisible(true)}>
                        <Image
                            source={require('./assets/needle.png')}
                            style={{ width: 50, height: 50, tintColor: '#e91e63' }}
                        />
                        <Text style={styles.actionLabel}>Insulina</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionButton}>
                        <Image
                            source={require('./assets/bike.png')}
                            style={{ width: 50, height: 50, tintColor: '#ff9800' }}
                        />
                        <Text style={styles.actionLabel}>Ejercicio</Text>
                    </TouchableOpacity>
                </View>

                {/* Gráfica SVG */}
                <View style={styles.graphContainer}>
                    {renderGraph()}
                </View>

                {/* Modales */}
                {isInsulinModalVisible && (
                    <InsulinModal
                        visible={isInsulinModalVisible}
                        onClose={() => setInsulinModalVisible(false)}
                        onSave={handleSaveInsulin}
                        userProfile={userProfile}
                        isSaving={isSavingEvent}
                    />
                )}

                {isFoodModalVisible && (
                    <FoodModal
                        visible={isFoodModalVisible}
                        onClose={() => setFoodModalVisible(false)}
                        onSave={handleSaveFood}
                        userProfile={userProfile}
                        isSaving={isSavingEvent}
                    />
                )}

            </View>
        </SafeAreaView >
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fafafa',
    },
    headerButton: {
        position: 'absolute',
        top: 60,
        left: 30,
        width: 60,
        height: 60,
        borderRadius: 100,
        backgroundColor: '#80beacff',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    headerButtonActive: {
        backgroundColor: '#FF9800',
    },
    headerSpacer: {
        paddingTop: 10, // Hueco para no solaparse con el botón
        alignItems: 'center',
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        marginVertical: 20,
        paddingHorizontal: 20,
    },
    actionButton: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fff',
        width: 80,
        height: 80,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    actionLabel: {
        fontSize: 12,
        color: '#757575',
        marginTop: 4,
        fontWeight: '600',
    },
    topHeader: {
        alignItems: 'center',
        marginBottom: 10,
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingLeft: 60,
    },
    glucoseValue: {
        fontSize: 110,
        fontWeight: 'bold',
        letterSpacing: -3,
    },
    trendArrow: {
        fontSize: 55,
        marginLeft: 15,
        color: '#757575',
        paddingBottom: 10,
        fontFamily: 'ArrowFont',
        fontWeight: 400,
        fontStyle: 'normal',
    },
    unitText: {
        fontSize: 24,
        color: '#9e9e9e',
        marginTop: -10,
    },
    graphContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
    },
    basalRowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 5,
    },
    basalBadge: {
        backgroundColor: '#f3e5f5', // Morado muy claro
        paddingVertical: 6,
        paddingHorizontal: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#e1bee7',
        marginRight: 10,
    },
    basalBadgeInactive: {
        backgroundColor: '#f5f5f5',
        borderColor: '#e0e0e0',
    },
    basalText: {
        color: '#9c27b0',
        fontSize: 13,
        fontWeight: '700',
    },
    basalTextInactive: {
        color: '#9e9e9e',
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        backgroundColor: '#fce4ec', // Fondo rosado muy clarito para match visual
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#f8bbd0',
    },
    checkboxLabel: {
        marginLeft: 6,
        fontSize: 13,
        fontWeight: '700',
        color: '#e91e63',
    },
});

export default GlucoseScanner;
