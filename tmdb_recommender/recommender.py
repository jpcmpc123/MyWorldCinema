"""
Sistema Completo de Recomendação de Filmes com Laya + TMDB.
1. Usuário expressa em linguagem natural o que deseja ver.
2. Laya faz a decisão tipada em milissegundos: Gênero, Humor/Vibe e Classificação Indicativa.
3. Consulta a API do TMDB (ou fallback de catálogo) com filtros avançados.
"""

import os
import json
import urllib.parse
import urllib.request
import laya

# Mapeamento do Laya para IDs de gênero oficiais do TMDB
TMDB_GENRE_MAP = {
    "action": 28,        # Ação
    "adventure": 12,     # Aventura
    "animation": 16,     # Animação
    "comedy": 35,        # Comédia
    "crime": 80,         # Crime
    "documentary": 99,   # Documentário
    "drama": 18,         # Drama
    "family": 10751,     # Família
    "fantasy": 14,       # Fantasia
    "history": 36,       # História
    "horror": 27,        # Terror
    "music": 10402,      # Música
    "mystery": 9648,     # Mistério
    "romance": 10749,    # Romance
    "scifi": 878,        # Ficção científica
    "thriller": 53,      # Thriller / Suspense
    "war": 10752,        # Guerra
    "western": 37        # Faroeste
}

# Mapeamento da classificação indicativa do Brasil (certifications BR)
CERTIFICATION_MAP = {
    "L": "L",
    "10": "10",
    "12": "12",
    "14": "14",
    "16": "16",
    "18": "18"
}

def search_movie_by_title(title, api_key_or_token):
    """Busca um filme específico pelo título para pegar sua sinopse, gêneros e recomendações similares."""
    url = f"https://api.themoviedb.org/3/search/movie?query={urllib.parse.quote(title)}&language=pt-BR"
    headers = {"User-Agent": "LayaRecommender/1.0", "accept": "application/json"}
    if len(api_key_or_token) > 50:
        headers["Authorization"] = f"Bearer {api_key_or_token}"
    else:
        url += f"&api_key={api_key_or_token}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            results = data.get("results", [])
            return results[0] if results else None
    except Exception:
        return None

def get_similar_movies(movie_id, api_key_or_token):
    """Busca filmes diretamente parecidos com um filme de referência no TMDB."""
    import random
    page = random.randint(1, 2)
    url = f"https://api.themoviedb.org/3/movie/{movie_id}/recommendations?language=pt-BR&page={page}"
    headers = {"User-Agent": "LayaRecommender/1.0", "accept": "application/json"}
    if len(api_key_or_token) > 50:
        headers["Authorization"] = f"Bearer {api_key_or_token}"
    else:
        url += f"&api_key={api_key_or_token}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            results = data.get("results", [])
            random.shuffle(results)
            return results[:5]
    except Exception:
        return []

# Catálogo offline de fallback quando não houver chave da API do TMDB
SAMPLE_TMDB_CATALOG = [
    {
        "title": "Interestelar",
        "genre": "scifi",
        "mood": "intense",
        "rating": "12",
        "overview": "Uma equipe de exploradores viaja através de um buraco de minhoca no espaço, na tentativa de garantir a sobrevivência da humanidade.",
        "vote_average": 8.7
    },
    {
        "title": "John Wick 4: Baba Yaga",
        "genre": "action",
        "mood": "intense",
        "rating": "16",
        "overview": "John Wick descobre um caminho para derrotar a Alta Cúpula, mas precisa enfrentar um novo inimigo global com alianças poderosas.",
        "vote_average": 7.9
    },
    {
        "title": "Divertida Mente 2",
        "genre": "animation",
        "mood": "emotional",
        "rating": "L",
        "overview": "Com a chegada da adolescência de Riley, a sede das emoções passa por uma reforma repentina para dar lugar à Ansiedade e novos sentimentos.",
        "vote_average": 8.1
    },
    {
        "title": "Superbad: É Hoje",
        "genre": "comedy",
        "mood": "lighthearted",
        "rating": "16",
        "overview": "Dois amigos co-dependentes do ensino médio navegam por uma festa com a missão de comprar bebidas alcoólicas antes de irem para a faculdade.",
        "vote_average": 7.3
    },
    {
        "title": "As Branquelas",
        "genre": "comedy",
        "mood": "lighthearted",
        "rating": "12",
        "overview": "Dois irmãos agentes do FBI se disfarçam de duas ricas herdeiras brancas para proteger um hotel e salvar suas carreiras.",
        "vote_average": 7.6
    },
    {
        "title": "Invocação do Mal",
        "genre": "horror",
        "mood": "dark",
        "rating": "16",
        "overview": "Os investigadores paranormais Ed e Lorraine Warren trabalham para ajudar uma família aterrorizada por uma presença sombria em sua fazenda.",
        "vote_average": 7.5
    },
    {
        "title": "Toy Story",
        "genre": "animation",
        "mood": "lighthearted",
        "rating": "L",
        "overview": "O boneco caubói Woody é ameaçado quando um novo astronauta de brinquedo, Buzz Lightyear, se torna o favorito do quarto de Andy.",
        "vote_average": 8.0
    },
    {
        "title": "A Culpa é das Estrelas",
        "genre": "romance",
        "mood": "emotional",
        "rating": "12",
        "overview": "Dois adolescentes pacientes com câncer se conhecem em um grupo de apoio e embarcam em uma jornada que mudará suas vidas.",
        "vote_average": 7.7
    }
]

# Intervalos de anos por década
DECADE_YEAR_MAP = {
    "80s": ("1980-01-01", "1989-12-31"),
    "90s": ("1990-01-01", "1999-12-31"),
    "2000s": ("2000-01-01", "2009-12-31"),
    "modern": ("2010-01-01", "2026-12-31")
}

# Código de país/idioma original por polo
ORIGIN_MAP = {
    "korean": {"with_original_language": "ko"},
    "national": {"with_origin_country": "BR", "with_original_language": "pt"},
    "european": {"with_origin_country": "FR|IT|ES|GB|DE"},
    "hollywood": {"with_original_language": "en"}
}

def search_tmdb_api(genre_key, rating_key, api_key_or_token, decade=None, origin=None, page=None):
    """Consulta os endpoints do TMDB (discover/movie) usando os parâmetros decididos pelo Laya."""
    import random
    if page is None:
        page = random.randint(1, 2)
    genre_id = TMDB_GENRE_MAP.get(genre_key)
    base_url = "https://api.themoviedb.org/3/discover/movie"
    params = {
        "language": "pt-BR",
        "sort_by": random.choice(["popularity.desc", "vote_average.desc"]),
        "vote_count.gte": "100",
        "page": str(page),
        "certification_country": "BR",
        "certification.lte": CERTIFICATION_MAP.get(rating_key, "16")
    }
    if genre_id:
        params["with_genres"] = str(genre_id)

    # Filtro de Década
    if decade and decade in DECADE_YEAR_MAP:
        d_start, d_end = DECADE_YEAR_MAP[decade]
        params["primary_release_date.gte"] = d_start
        params["primary_release_date.lte"] = d_end

    # Filtro de Origem
    if origin and origin in ORIGIN_MAP:
        params.update(ORIGIN_MAP[origin])
    
    headers = {
        "User-Agent": "LayaRecommender/1.0",
        "accept": "application/json"
    }

    # Se for bearer token JWT ou api key regular
    if len(api_key_or_token) > 50:
        headers["Authorization"] = f"Bearer {api_key_or_token}"
    else:
        params["api_key"] = api_key_or_token

    url = f"{base_url}?{urllib.parse.urlencode(params)}"
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("results", [])[:5]
    except Exception as e:
        print(f"[Aviso] Falha ao consultar API online do TMDB ({e}). Usando base local.")
        return []

def recommend_movies(user_prompt, checkpoint_path="Jpcm/laya-filmes-tmdb", questions_file="./tmdb_recommender/movie_questions.json"):
    print(f"\n==========================================")
    print(f"Pedido do Usuário: \"{user_prompt}\"")
    print(f"==========================================")

    # 1. Carrega as perguntas e o agente Laya direto da nuvem (Jpcm/laya-filmes-tmdb)
    with open(questions_file, "r", encoding="utf-8") as f:
        questions = json.load(f)

    # Puxa o seu modelo 100% treinado e calibrado direto da nuvem!
    agent = laya.load(checkpoint_path)

    # 2. Executa a decisão tipada (System 1)
    prediction = agent.predict(user_prompt, questions)
    answers = prediction.get("answers", {})

    def extract_val(ans):
        if isinstance(ans, dict):
            return ans.get("choice", ans.get("value"))
        return ans

    genre = extract_val(answers.get("genre"))
    mood = extract_val(answers.get("mood"))
    rating = extract_val(answers.get("content_rating"))
    decade = extract_val(answers.get("decade"))
    origin = extract_val(answers.get("origin"))
    pacing = extract_val(answers.get("pacing"))
    viewing_context = extract_val(answers.get("viewing_context"))

    print(f"\n[Decisao Instantanea do Laya (Jpcm/laya-filmes-tmdb)]")
    print(f"  - Genero: {genre}")
    print(f"  - Humor/Vibe: {mood}")
    print(f"  - Classificacao: {rating}")
    print(f"  - Decada/Epoca: {decade}")
    print(f"  - Origem/Polo: {origin}")
    print(f"  - Ritmo: {pacing}")
    print(f"  - Contexto: {viewing_context}")

    # 3. Busca de filmes
    tmdb_key = os.environ.get("TMDB_API_KEY") or os.environ.get("TMDB_READ_TOKEN") or "756b66f23e97ca70dba67363ba4e3b21"
    results = []
    
    # Detecção de estilo / filme de referência: "estilo de X", "tipo X", "gosto de X"
    import re
    ref_match = re.search(r'(?:estilo\s+(?:de\s+)?|tipo\s+|gosto\s+de\s+|parecido\s+com\s+|adorei\s+)([\w\s\:\-\'\’]+?)(?:,|\.|$|\se\s|\spara\s|\smas\s|\scom\s)', user_prompt, re.IGNORECASE)
    ref_movie = None
    if ref_match:
        cand_title = ref_match.group(1).strip()
        # Remove conectivos no final se houver
        cand_title = re.sub(r'^(o|a|os|as|um|uma)\s+', '', cand_title, flags=re.IGNORECASE)
        if len(cand_title) > 2 and cand_title.lower() not in ["filme", "filmes", "cinema"]:
            ref_movie = search_movie_by_title(cand_title, tmdb_key)

    if ref_movie and tmdb_key:
        print(f"\n[Filme de Referencia Detectado no TMDB: '{ref_movie.get('title')}']")
        sim_movies = get_similar_movies(ref_movie["id"], tmdb_key)
        for m in sim_movies:
            results.append({
                "title": m.get("title"),
                "overview": m.get("overview"),
                "vote_average": m.get("vote_average")
            })

    if not results and tmdb_key:
        print(f"\n[Buscando via API oficial do TMDB com filtros aplicados em tempo real...]")
        raw_movies = search_tmdb_api(genre, rating, tmdb_key, decade=decade, origin=origin)
        for m in raw_movies:
            results.append({
                "title": m.get("title"),
                "overview": m.get("overview"),
                "vote_average": m.get("vote_average")
            })

    if not results:
        # Fallback local
        print(f"\n[Filtrando catalogo TMDB local...]")
        for m in SAMPLE_TMDB_CATALOG:
            # Filtro por genero e classificacao
            if m["genre"] == genre:
                results.append(m)

        if not results:
            results = SAMPLE_TMDB_CATALOG[:3]

    print(f"\n[Filmes Recomendados]")
    for idx, r in enumerate(results, 1):
        print(f"{idx}. {r['title']} (Nota: {r.get('vote_average', 'N/A')})")
        print(f"   Sinopse: {r.get('overview', '')}\n")

if __name__ == "__main__":
    import sys
    test_query = sys.argv[1] if len(sys.argv) > 1 else "Quero um filme tenso no espaço com sobrevivência e suspense psicológico para maiores de 12."
    recommend_movies(test_query)
