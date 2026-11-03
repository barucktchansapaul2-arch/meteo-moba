# Prépare meteo.json une fois par heure (GitHub Actions) : un seul serveur interroge Open-Meteo pour les 164 localités,
# les téléphones lisent ensuite ce fichier. Sans cela, chaque téléphone compte pour 164 appels et, à Moba, les téléphones
# partagent souvent la même adresse Internet de l'opérateur : la limite gratuite d'Open-Meteo est vite atteinte (HTTP 429).
import json, os, sys, time, urllib.parse, urllib.request

API = 'https://api.open-meteo.com/v1/forecast'
SITE = 'https://barucktchansapaul2-arch.github.io/meteo-moba/meteo.json'
PARAMS = {   # mêmes variables que app.js
    'current': 'temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day,uv_index,surface_pressure',
    'hourly': 'temperature_2m,weather_code,is_day,precipitation_probability,visibility,uv_index',
    'daily': 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max',
    'timezone': 'Africa/Lubumbashi', 'forecast_days': 10, 'forecast_hours': 48,
}
LOT = 41                                                       # 4 demandes de 41 localités : adresses courtes

def lire(url, essais=4):
    for k in range(essais):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'RTM-Meteo-Moba'}), timeout=90) as r:
                return json.loads(r.read())
        except Exception as e:
            print('essai', k + 1, ':', e)
            if k < essais - 1: time.sleep(30 * (k + 1))
    raise RuntimeError('échec')

def valide(d, n):
    return isinstance(d, list) and len(d) == n and all(m.get('current') and m.get('hourly') and m.get('daily') for m in d)

villages = json.load(open('villages.json', encoding='utf-8'))
try:
    d = []
    for i in range(0, len(villages), LOT):
        lot = villages[i:i + LOT]
        p = dict(PARAMS, latitude=','.join(str(v[1]) for v in lot), longitude=','.join(str(v[2]) for v in lot))
        r = lire(f'{API}?{urllib.parse.urlencode(p)}')
        d += r if isinstance(r, list) else [r]
        time.sleep(2)
    if not valide(d, len(villages)): raise RuntimeError('réponse incomplète')
    sortie = {'quand': int(time.time() * 1000), 'd': d}
    print(len(d), 'localités mises à jour')
except Exception as e:                                         # Open-Meteo indisponible : on garde la dernière météo publiée
    print('Open-Meteo indisponible :', e)
    try:
        sortie = lire(SITE + f'?t={int(time.time())}', 2)
        if not valide(sortie.get('d'), len(villages)): raise RuntimeError('ancienne météo invalide')
        print('ancienne météo gardée')
    except Exception as e2:
        print('aucune météo à publier :', e2); sys.exit(0)    # le site reste publié, les téléphones interrogent Open-Meteo eux-mêmes
json.dump(sortie, open('meteo.json', 'w', encoding='utf-8'), separators=(',', ':'), ensure_ascii=False)
print('meteo.json :', os.path.getsize('meteo.json') // 1024, 'Ko')
