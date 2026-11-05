# Prueba final de la demo

Esta entrega se cierra en **modo demo sin claves**, según lo acordado. Las respuestas, tokens y costes están simulados. Se usa el flujo real de API, cola, worker, PostgreSQL, Redis y WebSockets.

## Abrirla ahora

En este equipo está disponible en **[http://localhost:3107](http://localhost:3107)**. La API está en [http://localhost:4000/health](http://localhost:4000/health).

Se ha utilizado el puerto 3107 para respetar otra aplicación que ya estaba en el 3000. Estos procesos locales son temporales; para levantarla después de reiniciar el equipo, utiliza Docker desde la carpeta del repositorio:

```sh
docker compose up
```

Con Docker, la dirección por defecto es [http://localhost:3000](http://localhost:3000). Requiere Docker instalado y los puertos de Compose libres. No necesita `.env` ni claves.

## Recorrido de aceptación (5 minutos)

1. Pulsa **Create something** y después **Run task**. Verás la actividad de los agentes, sus respuestas, tokens, coste y modelos. Al terminar habrá **6 pasos** y estado **Completed**.
2. Abre **Final result** y revisa el resultado. Pulsa cada agente o una fila del waterfall para inspeccionar sus llamadas.
3. Inicia otra tarea y recarga la página mientras trabaja. La ejecución debe recuperarse y terminar con el mismo resultado, sin duplicar pasos ni costes.
4. Prueba **Explore an idea**. El resultado debe referirse al onboarding de la aplicación de notas, sin convertirse en una comparación de Kafka y RabbitMQ.
5. Introduce `Plan a landing page for a coffee shop [retry]`. Al terminar habrá **9 pasos** y **2 llamadas del Reviewer**: se permite una única corrección.
6. En una tarea nueva abre **Configure agents**, establece un presupuesto de **0.001 USD** y ejecútala. Debe detenerse con **Budget exceeded**, mostrando el motivo.
7. Abre **Run history**. Filtra por estado y modelo; abre una ejecución anterior y comprueba su resultado. La comparativa muestra coste y latencia medios de las llamadas completadas.
8. Reduce la ventana a tamaño móvil. El contenido debe adaptarse sin desplazamiento horizontal de toda la página; las tablas pueden desplazarse dentro de su propio contenedor.

## Comprobaciones automáticas

Con dependencias instaladas y la demo arrancada:

```sh
pnpm demo:check
```

Para la instancia que está ejecutándose aquí, este comando utiliza directamente Node y evita depender de la versión global de pnpm:

```sh
node scripts/check-demo.mjs --web-url http://localhost:3107
```

La comprobación crea ejecuciones de prueba y verifica replay del socket, una corrección, una tarea genérica, el límite de presupuesto, validación y paginación. Se niega a ejecutarse contra proveedores reales.

Tras arrancar los contenedores:

```sh
pnpm smoke:compose
```

Este comando comprueba la web y un recorrido completo de seis pasos con eventos persistidos. El workflow de GitHub Actions arranca además los cinco servicios de Compose en un job aislado y conserva sus logs.

## Alcance del cierre

- **Incluido:** demo funcional, historial persistente, streaming, recuperación al recargar, revisión, presupuesto, tests, capturas y grabación.
- **Fuera de esta prueba por decisión acordada:** llamadas pagadas a OpenAI/Claude y envío de errores a un proyecto real de Sentry.
- **Límite del entorno:** este equipo no dispone de motor Docker. Se valida la configuración de Compose; su arranque Linux se prepara en CI y no se presenta como ejecutado localmente.

Los resultados técnicos y sus límites se documentan en [VERIFICATION.md](VERIFICATION.md).
