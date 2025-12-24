import { PhysicsEngine } from '../../src/math/physics';

describe('PhysicsEngine', () => {
    const engine = new PhysicsEngine();

    it('should calculate projectile motion', () => {
        // v0 = 10 m/s, angle = 45 deg
        // Range = v^2 * sin(2*theta) / g = 100 * 1 / 9.81 = 10.19 m
        // Max height = (v*sin(theta))^2 / 2g = (10*0.707)^2 / 19.62 = 50 / 19.62 = 2.55 m
        const result = engine.projectile(10, 45);
        const points = JSON.parse(result.result as string);

        expect(points.length).toBeGreaterThan(0);
        expect(result.steps).toEqual(expect.arrayContaining([expect.stringMatching(/Range: 10.19/)]));
        expect(result.steps).toEqual(expect.arrayContaining([expect.stringMatching(/Max Height: 2.55/)]));
    });

    it('should solve kinematics (v = u + at)', () => {
        // u=0, a=9.81, t=2 -> v=19.62
        const result = engine.kinematics({ u: 0, a: 9.81, t: 2 });
        const resObj = JSON.parse(result.result as string);
        expect(resObj.v).toBe(19.62);
    });

    it('should solve kinematics (s = ut + 0.5at^2)', () => {
        // u=0, t=2, a=10 -> s = 0 + 0.5*10*4 = 20
        const result = engine.kinematics({ u: 0, t: 2, a: 10 });
        const resObj = JSON.parse(result.result as string);
        expect(resObj.s).toBe(20);
    });
});
