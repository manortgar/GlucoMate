import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ActivityIndicator,
    TouchableOpacity,
    Dimensions
} from 'react-native';
import NfcManager, { NfcTech } from 'react-native-nfc-manager';
import Svg, { Path, Line, Text as SvgText } from 'react-native-svg';
import * as d3Shape from 'd3-shape';
import * as d3Scale from 'd3-scale';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const GRAPH_HEIGHT = height * 0.5;
const GRAPH_WIDTH = width;

const GlucoseScanner = () => {
    const [tagData, setTagData] = useState(null);
    const [historyData, setHistoryData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isNfcSupported, setIsNfcSupported] = useState(false);
    const [waitingForScan, setWaitingForScan] = useState(false);

    // IP DEL BACKEND (Actualizar si cambia)
    const backendUrlHistory = 'http://192.168.1.18:3000/api/glucose/history';
    const backendUrlUpload = 'http://192.168.1.18:3000/api/glucose';

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
        // Cargar el historial desde el backend Node al iniciar la app
        fetchHistory();

        return () => {
            NfcManager.cancelTechnologyRequest();
        };
    }, []);

    // Traemos el Mock de 12 horas desde la BD
    const fetchHistory = async () => {
        try {
            const response = await fetch(backendUrlHistory);
            const data = await response.json();
            if (data.length > 0) {
                // Adaptamos las fechas String a objetos Date para D3
                const formatted = data.map(d => ({
                    value: d.glucose_value,
                    time: new Date(d.reading_time)
                }));
                // Si Postgres nos devuelve muchisimos, nos quedamos maximo las ultimas 12h:
                setHistoryData(formatted);

                // Simulamos que el último punto del historial es la lectura actual al abrir
                setTagData({
                    bgs: [{
                        sgv: formatted[formatted.length - 1].value,
                        datetime: formatted[formatted.length - 1].time.getTime(),
                        direction: formatted[formatted.length - 1].trend || 'Flat'
                    }]
                });
            }
        } catch (error) {
            console.error('Error cargando historial:', error);
        }
    };

    const startInteraction = async () => {
        setWaitingForScan(true);
        try {
            await NfcManager.requestTechnology(NfcTech.NfcV);
            NfcManager.cancelTechnologyRequest();
            setWaitingForScan(false);
            await fetchJugglucoData();
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
        if (historyData.length === 0) return null;

        const max_12h = Math.max(...historyData.map(d => d.value));
        const maxY = max_12h + 50; // El tope dinámico solicitado
        const minY = 50; // Mínimo fijo

        const minTime = Math.min(...historyData.map(d => d.time.getTime()));
        const maxTime = Math.max(...historyData.map(d => d.time.getTime()));

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

        return (
            <Svg width={GRAPH_WIDTH} height={GRAPH_HEIGHT}>
                {/* Rectángulo de rango objetivo */}
                {y180 < (GRAPH_HEIGHT - 30) && y70 > 20 && (
                    <Path d={`M 20 ${y180} L ${GRAPH_WIDTH - 20} ${y180} L ${GRAPH_WIDTH - 20} ${y70} L 20 ${y70} Z`} fill="rgba(200, 230, 201, 0.4)" />
                )}

                <Line x1={20} y1={y180} x2={GRAPH_WIDTH - 20} y2={y180} stroke="#b0bec5" strokeWidth="1" strokeDasharray="4 4" />
                <Line x1={20} y1={y70} x2={GRAPH_WIDTH - 20} y2={y70} stroke="#b0bec5" strokeWidth="1" strokeDasharray="4 4" />

                <SvgText x={GRAPH_WIDTH - 30} y={y180 - 5} fontSize="10" fill="#9e9e9e" textAnchor="end">180</SvgText>
                <SvgText x={GRAPH_WIDTH - 30} y={y70 - 5} fontSize="10" fill="#9e9e9e" textAnchor="end">70</SvgText>

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
        if (!tagData || !tagData.bgs || tagData.bgs.length === 0) return null;
        const bg = tagData.bgs[0];

        // Color dinámico según la cifra
        let valColor = '#2196F3'; // Azul normal
        if (bg.sgv < 70) valColor = '#f44336'; // Rojo hipo
        if (bg.sgv > 180) valColor = '#ff9800'; // Naranja hiper

        return (
            <View style={styles.topHeader}>
                <View style={styles.valueRow}>
                    <Text style={[styles.glucoseValue, { color: valColor }]}>{bg.sgv}</Text>
                    <Text style={styles.trendArrow}>{getTrendArrow(bg.direction)}</Text>
                </View>
                <Text style={styles.unitText}>mg/dL</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {/* Cabecera Enorme */}
            {renderCurrentGlucose()}

            {/* Gráfica SVG */}
            <View style={styles.graphContainer}>
                {renderGraph()}
            </View>

            {/* Floating Action Button (FAB) Discreto Abajo Derecha */}
            <TouchableOpacity
                style={[styles.fab, waitingForScan ? styles.fabActive : null]}
                onPress={waitingForScan ? () => setWaitingForScan(false) : startInteraction}
            >
                {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                ) : (
                    <MaterialCommunityIcons
                        name={waitingForScan ? "nfc-search-variant" : "nfc"}
                        size={32}
                        color="#fff"
                    />
                )}
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fafafa',
        paddingTop: 80, // Dejamos hueco a la barra de estado superior
    },
    topHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    valueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
    },
    glucoseValue: {
        fontSize: 110, // Enorme
        fontWeight: 'bold',
        letterSpacing: -3,
    },
    trendArrow: {
        fontSize: 55,
        marginLeft: 15,
        color: '#757575',
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
        marginBottom: 80, // Hueco para el botón
    },
    fab: {
        position: 'absolute',
        bottom: 50,
        right: 40,
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: '#2196F3',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 6, // Sombra en Android
        shadowColor: '#000', // Sombras en iOS
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    fabActive: {
        backgroundColor: '#FF9800', // Naranja/Warning si está esperando sensor
    }
});

export default GlucoseScanner;
