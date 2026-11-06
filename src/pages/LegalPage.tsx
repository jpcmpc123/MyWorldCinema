import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Shield, FileText, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export const LegalPage: React.FC = () => {
  const { pathname } = useLocation();
  const { language, t } = useLanguage();
  const isPt = language === 'pt-BR';
  const isPrivacy = pathname === '/privacy';

  return (
    <div className="max-w-[780px] mx-auto px-4 py-8 md:py-12 space-y-6">
      <div className="flex items-center justify-between gap-4 border-b border-lb-elevated pb-4">
        <div className="flex items-center gap-2.5">
          {isPrivacy ? (
            <Shield className="w-6 h-6 text-lb-green shrink-0" />
          ) : (
            <FileText className="w-6 h-6 text-lb-green shrink-0" />
          )}
          <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
            {isPrivacy
              ? isPt
                ? 'Política de Privacidade e LGPD'
                : 'Privacy Policy'
              : isPt
                ? 'Termos de Uso'
                : 'Terms of Use'}
          </h1>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-lb-muted hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t('common_back')}</span>
        </Link>
      </div>

      {/* Alternador entre Termos e Privacidade */}
      <div className="flex gap-2">
        <Link
          to="/terms"
          className={`px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
            !isPrivacy
              ? 'bg-lb-green text-lb-bg'
              : 'bg-lb-surface text-lb-text hover:text-white border border-lb-elevated'
          }`}
        >
          {isPt ? 'Termos de Uso' : 'Terms of Use'}
        </Link>
        <Link
          to="/privacy"
          className={`px-3.5 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-colors ${
            isPrivacy
              ? 'bg-lb-green text-lb-bg'
              : 'bg-lb-surface text-lb-text hover:text-white border border-lb-elevated'
          }`}
        >
          {isPt ? 'Política de Privacidade' : 'Privacy Policy'}
        </Link>
      </div>

      {isPrivacy ? (
        <div className="bg-lb-surface border border-lb-elevated rounded-lg p-6 space-y-5 text-xs md:text-sm text-lb-text leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm md:text-base font-bold text-white">
              {isPt ? '1. Dados Coletados' : '1. Data Collected'}
            </h2>
            <p>
              {isPt
                ? 'O MyWorld Cinema coleta apenas os dados estritamente necessários para o funcionamento da sua conta: endereço de e-mail, nome de usuário, nome de exibição, biografia, foto de perfil opcional e os registros de filmes/séries que você salva (diário, críticas, notas, curtidas, listas e watchlist).'
                : 'MyWorld Cinema collects only the minimum data required to operate your account: email address, username, display name, bio, optional avatar image, and the film/series logs you create (diary entries, reviews, ratings, likes, lists, and watchlist).'}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm md:text-base font-bold text-white">
              {isPt ? '2. Finalidade e Armazenamento (Supabase)' : '2. Purpose and Storage (Supabase)'}
            </h2>
            <p>
              {isPt
                ? 'Os dados da sua conta são armazenados com segurança no Supabase com proteção por políticas de Row-Level Security (RLS). Também utilizamos armazenamento local (localStorage) no seu navegador exclusivamente para preferências de idioma, cache de catálogo e desempenho da interface.'
                : 'Your account data is securely stored in Supabase protected by Row-Level Security (RLS) policies. We also use browser localStorage strictly for language preferences, catalog caching, and UI performance.'}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm md:text-base font-bold text-white">
              {isPt ? '3. Seus Direitos (LGPD / GDPR)' : '3. Your Rights (LGPD / GDPR)'}
            </h2>
            <p>
              {isPt
                ? 'Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD), você tem direito de acessar, corrigir, exportar seus dados em formato CSV (disponível em Configurações → Dados) e excluir seus registros a qualquer momento. Não vendemos nem compartilhamos seus dados pessoais com terceiros para fins publicitários.'
                : 'In compliance with data protection laws (including LGPD and GDPR), you have the right to access, update, export your data in CSV format (available in Settings → Data), and delete your entries at any time. We never sell or share your personal data with third parties for advertising.'}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm md:text-base font-bold text-white">
              {isPt ? '4. Serviços de Terceiros' : '4. Third-Party Services'}
            </h2>
            <p>
              {isPt
                ? 'Os metadados, pôsteres e imagens de filmes e séries são consultados em tempo real na API do TMDb (The Movie Database). Ao optar pelo login com Google OAuth, recebemos apenas seu identificador básico de autenticação e e-mail.'
                : 'Film and series metadata, posters, and backdrops are fetched from the TMDb (The Movie Database) API. If you sign in with Google OAuth, we receive only your basic authentication identifier and email address.'}
            </p>
          </section>
        </div>
      ) : (
        <div className="bg-lb-surface border border-lb-elevated rounded-lg p-6 space-y-5 text-xs md:text-sm text-lb-text leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm md:text-base font-bold text-white">
              {isPt ? '1. Uso da Plataforma' : '1. Platform Usage'}
            </h2>
            <p>
              {isPt
                ? 'O MyWorld Cinema é uma plataforma para descoberta, catalogação pessoal e publicação de críticas e listas de filmes e séries. Ao criar uma conta, você é responsável por manter a segurança da sua senha e pelo conteúdo das críticas e listas públicas que publicar.'
                : 'MyWorld Cinema is a platform for discovering, tracking, and publishing reviews and lists of films and series. By creating an account, you are responsible for keeping your password secure and for the content of the public reviews and lists you publish.'}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm md:text-base font-bold text-white">
              {isPt ? '2. Conduta da Comunidade' : '2. Community Conduct'}
            </h2>
            <p>
              {isPt
                ? 'Não é permitido publicar spam, conteúdo ilegal, discurso de ódio, assédio ou violação de direitos autorais nas críticas, listas ou perfil. Sempre marque a opção de aviso de spoiler quando sua crítica revelar detalhes essenciais do enredo.'
                : 'Posting spam, unlawful content, hate speech, harassment, or copyright-infringing material in reviews, lists, or profiles is strictly prohibited. Please mark the spoiler toggle whenever your review reveals major plot points.'}
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm md:text-base font-bold text-white">
              {isPt ? '3. Propriedade Intelectual e Atribuição TMDb' : '3. Intellectual Property & TMDb Attribution'}
            </h2>
            <p>
              {isPt
                ? 'Este produto utiliza a API do TMDb, mas não é endossado nem certificado pelo TMDb. Todos os pôsteres, sinopses e marcas de filmes pertencem aos seus respectivos detentores. Suas críticas e listas autorais permanecem de sua titularidade, podendo ser exportadas a qualquer momento.'
                : 'This product uses the TMDb API but is not endorsed or certified by TMDb. All film posters, synopses, and trademarks belong to their respective owners. Your original reviews and curated lists remain yours and can be exported at any time.'}
            </p>
          </section>
        </div>
      )}
    </div>
  );
};

export default LegalPage;
