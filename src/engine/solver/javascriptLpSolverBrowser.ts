import Model from 'javascript-lp-solver/src/Model.js';
import Polyopt from 'javascript-lp-solver/src/Polyopt.js';
import Tableau from 'javascript-lp-solver/src/Tableau/index.js';
import 'javascript-lp-solver/src/Tableau/branchAndCut.js';
import expressions from 'javascript-lp-solver/src/expressions.js';
import validation from 'javascript-lp-solver/src/Validation.js';
import type {SolverModel, SolverResults} from '@engine/types/domain';

const {Constraint, Numeral, Term, Variable} = expressions;

class Solver {
    Model: typeof Model;
    Constraint: typeof Constraint;
    Variable: typeof Variable;
    Numeral: typeof Numeral;
    Term: typeof Term;
    Tableau: typeof Tableau;
    lastSolvedModel: InstanceType<typeof Model> | null;

    constructor() {
        this.Model = Model;
        this.Constraint = Constraint;
        this.Variable = Variable;
        this.Numeral = Numeral;
        this.Term = Term;
        this.Tableau = Tableau;
        this.lastSolvedModel = null;
    }

    // 浏览器部署只保留内置 JS 求解路径，不引入外部 CLI 求解器。
    Solve(model: SolverModel | InstanceType<typeof Model>, precision?: number, full?: boolean, validateModel?: boolean): SolverResults {
        if (validateModel) {
            for (const test in validation) {
                model = validation[test](model);
            }
        }

        if (!model) {
            throw new Error('Solver requires a model to operate on');
        }

        if (typeof model.optimize === 'object' && Object.keys(model.optimize).length > 1) {
            return Polyopt(this, model);
        }

        if (model instanceof Model === false) {
            model = new Model(precision).loadJson(model);
        }

        const solution = model.solve();
        this.lastSolvedModel = model;
        solution.solutionSet = solution.generateSolutionSet();

        if (full) {
            return solution;
        }

        const store: SolverResults = {
            feasible: solution.feasible,
            result: solution.evaluation,
            bounded: solution.bounded,
        };

        if (solution._tableau.__isIntegral) {
            store.isIntegral = true;
        }

        Object.keys(solution.solutionSet).forEach(key => {
            if (solution.solutionSet[key] !== 0) {
                store[key] = solution.solutionSet[key];
            }
        });

        return store;
    }

    MultiObjective(model: SolverModel): SolverResults {
        return Polyopt(this, model);
    }
}

const solver = new Solver();

export default solver;
