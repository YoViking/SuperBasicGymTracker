import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { ShieldCheck, HeartPulse, Cookie, Copyright, FileText, Lock } from 'lucide-react-native';

export default function LegalTermsContent() {
  return (
    <View style={styles.container}>
      {/* Hero Badge */}
      <View style={styles.heroBadge}>
        <ShieldCheck size={20} color="#A3E635" />
        <Text style={styles.heroBadgeText}>Senast uppdaterad: Augusti 2026</Text>
      </View>

      <Text style={styles.mainTitle}>Användarvillkor & Integritet</Text>
      <Text style={styles.introText}>
        Välkommen till <Text style={styles.boldWhite}>Workout Player</Text>. Genom att skapa ett konto eller använda appen godkänner du följande villkor, dataskyddspolicy och ansvarsfriskrivningar.
      </Text>

      {/* Section 1: Friskrivning för Hälsa */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
            <HeartPulse size={20} color="#EF4444" />
          </View>
          <Text style={styles.sectionTitle}>1. Hälsa & Ansvarsfriskrivning</Text>
        </View>
        <Text style={styles.paragraph}>
          Workout Player är ett digitalt verktyg för loggning och planering av styrketräning. Appen och dess funktioner (inklusive eventuella AI-genererade träningsupplägg) ersätter inte professionell medicinsk rådgivning, diagnos eller personlig träning.
        </Text>
        <Text style={styles.paragraph}>
          All fysisk träning och belastning sker <Text style={styles.highlight}>helt på egen risk</Text>. Rådfråga alltid läkare eller legitimerad fysioterapeut innan du påbörjar nya eller intensiva träningsprogram.
        </Text>
      </View>

      {/* Section 2: Upphovsrätt & Copyright */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(163, 230, 53, 0.15)' }]}>
            <Copyright size={20} color="#A3E635" />
          </View>
          <Text style={styles.sectionTitle}>2. Upphovsrätt & Tredjepartsinnehåll</Text>
        </View>
        <Text style={styles.paragraph}>
          Källkod, applikationsarkitektur, gränssnittsdesign, varumärke, logotyper och ljudeffekter i <Text style={styles.boldWhite}>Workout Player</Text> tillhör Joakim Viking och skyddas av upphovsrättslagstiftning.
        </Text>
        <View style={styles.copyrightHighlightBox}>
          <Text style={styles.copyrightText}>
            Copyright © 2026 Workout Player / Joakim Viking. Alla rättigheter förbehållna för applikationen.
          </Text>
        </View>
        <Text style={styles.paragraph}>
          <Text style={styles.boldWhite}>Övningsdatabas & Illustrationer:</Text> Övningsnamn, anatomiska beskrivningar, illustrationer och animationer tillhandahålls i pedagogiskt syfte och härrör från externa datakällor och licensierade/öppna träningsdatabaser (bl.a. ExerciseDB). Dessa tillhör respektive rättighetsinnehavare och upphovsmän. Workout Player gör inget anspråk på äganderätt till detta externa material.
        </Text>
      </View>

      {/* Section 3: Integritet & GDPR */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
            <Lock size={20} color="#3B82F6" />
          </View>
          <Text style={styles.sectionTitle}>3. Integritet & Datainsamling (GDPR)</Text>
        </View>
        <Text style={styles.paragraph}>
          Vi värnar om din personliga integritet och samlar endast in de uppgifter som krävs för att appen ska fungera optimalt:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• <Text style={styles.boldWhite}>Kontouppgifter:</Text> E-postadress och eventuellt namn vid inloggning.</Text>
          <Text style={styles.bulletItem}>• <Text style={styles.boldWhite}>Träningsdata:</Text> Övningar, set, reps, vikter, kroppsvikt och tider för att räkna ut volym och personliga rekord.</Text>
          <Text style={styles.bulletItem}>• <Text style={styles.boldWhite}>Säkerhet:</Text> Lösenord lagras alltid envägskrypterade (hashade) och kan aldrig läsas av oss.</Text>
        </View>
        <Text style={styles.paragraph}>
          Vi säljer eller delar aldrig dina personuppgifter med tredjepartsannonsörer.
        </Text>
      </View>

      {/* Section 4: Cookies & Lokal lagring */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <Cookie size={20} color="#F59E0B" />
          </View>
          <Text style={styles.sectionTitle}>4. Cookies, Lokal lagring & Utveckling</Text>
        </View>
        <Text style={styles.paragraph}>
          I mobila applikationer används enhetens lokala lagring (<Text style={styles.highlight}>AsyncStorage / SecureStore</Text>) på samma sätt som cookies på en webbplats. Detta används för att:
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Hålla dig inloggad mellan sessioner.</Text>
          <Text style={styles.bulletItem}>• Spara dina personliga inställningar (t.ex. vilotimer och skärmläge).</Text>
          <Text style={styles.bulletItem}>• Cacha dina träningspass lokalt för omedelbar laddning (0 ms) och offline-stöd på gymmet.</Text>
          <Text style={styles.bulletItem}>• Samla anonym teknisk diagnostik för att upptäcka buggar och förbättra appens prestanda under löpande utveckling.</Text>
        </View>
      </View>

      {/* Section 5: Konto & Radering */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.iconBox, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
            <FileText size={20} color="#A855F7" />
          </View>
          <Text style={styles.sectionTitle}>5. Radering av konto & Ändringar</Text>
        </View>
        <Text style={styles.paragraph}>
          Du har full kontroll över dina data. Du kan när som helst begära fullständig radering av ditt konto och all tillhörande träningshistorik.
        </Text>
        <Text style={styles.paragraph}>
          Vi förbehåller oss rätten att uppdatera dessa villkor när ny funktionalitet lanseras. Fortsatt användning av Workout Player efter uppdatering innebär att du godkänner de nya villkoren.
        </Text>
      </View>

      {/* Footer disclaimer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Workout Player • Utvecklad med stolthet av Joakim Viking</Text>
        <Text style={styles.footerSubText}>Version 1.0.0 (Production Build)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(163, 230, 53, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(163, 230, 53, 0.25)',
  },
  heroBadgeText: {
    color: '#A3E635',
    fontSize: 13,
    fontWeight: '700',
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#F8FAFC',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  introText: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  sectionCard: {
    backgroundColor: '#18181B',
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#F8FAFC',
    flex: 1,
  },
  paragraph: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 10,
  },
  boldWhite: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  highlight: {
    color: '#A3E635',
    fontWeight: '700',
  },
  copyrightHighlightBox: {
    backgroundColor: 'rgba(163, 230, 53, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#A3E635',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginVertical: 10,
  },
  copyrightText: {
    color: '#A3E635',
    fontSize: 13,
    fontWeight: '700',
  },
  bulletList: {
    paddingLeft: 4,
    marginVertical: 6,
    gap: 8,
  },
  bulletItem: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    marginTop: 12,
    gap: 4,
  },
  footerText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  footerSubText: {
    color: '#475569',
    fontSize: 12,
  },
});
